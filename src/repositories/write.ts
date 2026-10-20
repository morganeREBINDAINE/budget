import { and, eq, getTableColumns, isNull, type SQL } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import type { Database } from '@/db/client';
import { syncedTables, syncQueue, type SyncedTableName } from '@/db/schema';
import { notifyLocalWrite } from '@/repositories/localWrites';

// Outil d'écriture commun (docs/STORAGE.md §2) : toute écriture d'une table synchronisée passe par
// ici. La ligne et son entrée `sync_queue` sont écrites dans une même transaction SQLite : si l'une
// échoue, rien n'est écrit et l'erreur remonte à l'appelant.
//
// Le pilote expo-sqlite exécute les transactions de façon synchrone : les callbacks de
// `writeTransaction` ne doivent jamais être `async` (aucun `await` à l'intérieur).

type Tables = typeof syncedTables;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Ligne telle qu'enregistrée en local (et copiée dans le payload de `sync_queue`). */
export type SyncedRow<T extends SyncedTableName> = Tables[T]['$inferSelect'];

// Colonnes renseignées par l'outil, jamais par l'appelant.
type ManagedColumn = 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'deletedAt';

export type InsertValues<T extends SyncedTableName> = Omit<
  Tables[T]['$inferInsert'],
  ManagedColumn
>;
export type UpdatePatch<T extends SyncedTableName> = Partial<InsertValues<T>>;

/** Tables avec suppression logique (`recurring_occurrences` n'en a pas). */
export type SoftDeletableTableName = {
  [K in SyncedTableName]: 'deletedAt' extends keyof SyncedRow<K> ? K : never;
}[SyncedTableName];

/** La ligne n'existe pas, appartient à un autre compte ou est supprimée. */
export class RowNotFoundError extends Error {
  constructor(tableName: SyncedTableName) {
    super(`Élément introuvable (${tableName})`);
    this.name = 'RowNotFoundError';
  }
}

export type Writer = {
  insert<T extends SyncedTableName>(tableName: T, values: InsertValues<T>): SyncedRow<T>;
  update<T extends SyncedTableName>(tableName: T, id: string, patch: UpdatePatch<T>): SyncedRow<T>;
  softDelete<T extends SoftDeletableTableName>(tableName: T, id: string): SyncedRow<T>;
};

// Requêtes génériques : Drizzle ne sait pas typer une union de tables, les types précis sont
// garantis par les signatures publiques ci-dessus.
type LooseTable = Tables['categories'];

function tableOf(tableName: SyncedTableName): LooseTable {
  return syncedTables[tableName] as unknown as LooseTable;
}

function hasSoftDelete(table: LooseTable): boolean {
  return 'deletedAt' in getTableColumns(table);
}

/**
 * Horodatage client ISO, strictement postérieur à la version précédente de la ligne : si l'horloge
 * du téléphone recule, une modification locale ne perd jamais face à sa propre version précédente.
 */
export function nextTimestamp(previous?: string): string {
  const now = Date.now();
  const min = previous === undefined ? now : Date.parse(previous) + 1;
  return new Date(Math.max(now, min)).toISOString();
}

function createWriter(
  tx: Transaction,
  userId: string,
  isOpen: () => boolean,
  onEnqueue: () => void,
): Writer {
  const ensureOpen = () => {
    if (!isOpen()) throw new Error('Écriture hors transaction (callback asynchrone ?)');
  };

  const rowCondition = (table: LooseTable, id: string): SQL => {
    const conditions = [eq(table.id, id), eq(table.userId, userId)];
    if (hasSoftDelete(table)) conditions.push(isNull(table.deletedAt));
    return and(...conditions) as SQL;
  };

  const readRow = (table: LooseTable, id: string) =>
    tx.select().from(table).where(rowCondition(table, id)).get();

  // Relit la ligne écrite (valeurs par défaut et NULL compris) et l'ajoute à la file d'envoi.
  const enqueue = <T extends SyncedTableName>(tableName: T, id: string, at: string) => {
    const table = tableOf(tableName);
    const row = tx
      .select()
      .from(table)
      .where(and(eq(table.id, id), eq(table.userId, userId)))
      .get();
    if (!row) throw new RowNotFoundError(tableName);
    tx.insert(syncQueue)
      .values({
        id: randomUUID(),
        userId,
        tableName,
        rowId: id,
        op: 'upsert',
        payload: row,
        createdAt: at,
      })
      .run();
    onEnqueue();
    return row as SyncedRow<T>;
  };

  return {
    insert(tableName, values) {
      ensureOpen();
      const id = randomUUID();
      const at = nextTimestamp();
      tx.insert(tableOf(tableName))
        .values({ ...values, id, userId, createdAt: at, updatedAt: at } as never)
        .run();
      return enqueue(tableName, id, at);
    },

    update(tableName, id, patch) {
      ensureOpen();
      const table = tableOf(tableName);
      const existing = readRow(table, id);
      if (!existing) throw new RowNotFoundError(tableName);
      const at = nextTimestamp(existing.updatedAt);
      tx.update(table)
        .set({ ...patch, updatedAt: at } as never)
        .where(rowCondition(table, id))
        .run();
      return enqueue(tableName, id, at);
    },

    softDelete(tableName, id) {
      ensureOpen();
      const table = tableOf(tableName);
      const existing = readRow(table, id);
      if (!existing) throw new RowNotFoundError(tableName);
      const at = nextTimestamp(existing.updatedAt);
      tx.update(table).set({ updatedAt: at, deletedAt: at }).where(rowCondition(table, id)).run();
      return enqueue(tableName, id, at);
    },
  };
}

/**
 * Exécute plusieurs écritures du compte `userId` de façon atomique (ex. « J'ai payé » = dépense +
 * occurrence, import). Le callback doit être synchrone. Une fois la transaction validée, le moteur
 * de synchro est prévenu (`notifyLocalWrite`) s'il y a des entrées à envoyer.
 */
export function writeTransaction<R>(db: Database, userId: string, fn: (writer: Writer) => R): R {
  let enqueued = false;
  const result = db.transaction((tx) => {
    let open = true;
    try {
      const value = fn(
        createWriter(
          tx,
          userId,
          () => open,
          () => (enqueued = true),
        ),
      );
      if (value instanceof Promise) {
        throw new Error('Le callback de writeTransaction doit être synchrone');
      }
      return value;
    } finally {
      open = false;
    }
  });
  if (enqueued) notifyLocalWrite(userId);
  return result;
}

/** Crée une ligne (id UUID, `user_id`, horodatages) et l'ajoute à la file d'envoi. */
export function insertRow<T extends SyncedTableName>(
  db: Database,
  tableName: T,
  userId: string,
  values: InsertValues<T>,
): SyncedRow<T> {
  return writeTransaction(db, userId, (w) => w.insert(tableName, values));
}

/** Modifie une ligne non supprimée du compte ; `RowNotFoundError` sinon. */
export function updateRow<T extends SyncedTableName>(
  db: Database,
  tableName: T,
  userId: string,
  id: string,
  patch: UpdatePatch<T>,
): SyncedRow<T> {
  return writeTransaction(db, userId, (w) => w.update(tableName, id, patch));
}

/** Suppression logique (`deleted_at`) d'une ligne non supprimée du compte ; `RowNotFoundError` sinon. */
export function softDeleteRow<T extends SoftDeletableTableName>(
  db: Database,
  tableName: T,
  userId: string,
  id: string,
): SyncedRow<T> {
  return writeTransaction(db, userId, (w) => w.softDelete(tableName, id));
}
