import { and, count, eq, getTableColumns, isNull, sql, type SQL } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { categories, syncedTables, syncQueue, type SyncedTableName } from '@/db/schema';
import type { SyncedRow } from '@/repositories/write';

// Enregistrement des lignes venues de Supabase (pull). Pas de passage par l'outil d'écriture :
// une ligne reçue n'est jamais ajoutée à `sync_queue` (elle serait renvoyée telle quelle).

// Colonnes jamais modifiées par un pull : identité de la ligne et date de création.
const IMMUTABLE_COLUMNS = new Set(['id', 'userId', 'createdAt']);

// Lots de lignes par requête SQLite (limite de variables liées).
const CHUNK_SIZE = 100;

// Requêtes génériques : Drizzle ne sait pas typer une union de tables.
type LooseTable = (typeof syncedTables)['categories'];

/**
 * Enregistre des lignes du compte `userId` venues de Supabase, dans une transaction SQLite.
 * Une ligne absente est insérée ; une ligne existante n'est remplacée que si la version distante
 * est plus récente (`updated_at`) **et** qu'aucune modification locale de cette ligne n'attend
 * dans `sync_queue` (elle sera envoyée par le push).
 */
export function saveRemoteRows<T extends SyncedTableName>(
  db: Database,
  userId: string,
  tableName: T,
  rows: SyncedRow<T>[],
): void {
  if (rows.length === 0) return;
  if (rows.some((row) => row.userId !== userId)) {
    throw new Error(`Lignes d’un autre compte refusées (${tableName})`);
  }

  const table = syncedTables[tableName] as unknown as LooseTable;
  const set: Record<string, SQL> = {};
  for (const [key, column] of Object.entries(getTableColumns(table))) {
    if (!IMMUTABLE_COLUMNS.has(key)) set[key] = sql.raw(`excluded."${column.name}"`);
  }
  const setWhere = sql`excluded.updated_at > ${table.updatedAt}
    AND ${table.userId} = ${userId}
    AND NOT EXISTS (
      SELECT 1 FROM ${syncQueue}
      WHERE ${syncQueue.userId} = ${userId}
        AND ${syncQueue.tableName} = ${tableName}
        AND ${syncQueue.rowId} = ${table.id}
    )`;

  db.transaction((tx) => {
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      tx.insert(table)
        .values(rows.slice(i, i + CHUNK_SIZE) as never)
        .onConflictDoUpdate({ target: table.id, set, setWhere })
        .run();
    }
  });
}

/** Le compte a au moins une catégorie non supprimée en local. */
export function hasLocalCategories(db: Database, userId: string): boolean {
  const row = db
    .select({ value: count() })
    .from(categories)
    .where(and(eq(categories.userId, userId), isNull(categories.deletedAt)))
    .get();
  return (row?.value ?? 0) > 0;
}
