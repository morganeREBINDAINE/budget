import { and, asc, eq, getTableColumns, isNull, type SQL } from 'drizzle-orm';

import type { Backup, BackupRow, BackupRows } from '@/backup/format';
import type { Database } from '@/db/client';
import {
  categories,
  debtPeople,
  SYNCED_TABLES,
  syncedTables,
  type SyncedTableName,
} from '@/db/schema';
import {
  writeTransaction,
  type InsertValues,
  type SoftDeletableTableName,
  type Writer,
} from '@/repositories/write';

// Sauvegarde JSON (`src/backup/format.ts`) : lecture de toutes les données du compte (export) et
// remplacement de toutes les données du compte par celles d'une sauvegarde (import).

// Requêtes génériques : Drizzle ne sait pas typer une union de tables.
type LooseTable = (typeof syncedTables)['categories'];

/**
 * Lignes non supprimées du compte `userId`, sans `user_id` ni `deleted_at`, triées par date de
 * création. Les occurrences d'un paiement régulier supprimé ne sont pas exportées (inutiles sans
 * leur paiement).
 */
export function readBackup(db: Database, userId: string, now = new Date()): Backup {
  const rows = {} as Record<string, Record<string, unknown>[]>;
  for (const tableName of SYNCED_TABLES) {
    const table = syncedTables[tableName] as unknown as LooseTable;
    const conditions: SQL[] = [eq(table.userId, userId)];
    if ('deletedAt' in getTableColumns(table)) conditions.push(isNull(table.deletedAt));
    rows[tableName] = db
      .select()
      .from(table)
      .where(and(...conditions))
      .orderBy(asc(table.createdAt), asc(table.id))
      .all()
      .map(({ userId: _userId, deletedAt: _deletedAt, ...row }) => row);
  }

  const paymentIds = new Set(rows.recurring_payments.map((p) => p.id));
  rows.recurring_occurrences = rows.recurring_occurrences.filter((o) =>
    paymentIds.has(o.recurringPaymentId as string),
  );

  return { exportedAt: now.toISOString(), rows: rows as unknown as BackupRows };
}

// Tables vidées par l'import (suppression logique) ; les personnes sont supprimées définitivement,
// les catégories modifiées sur place, les occurrences gardées (sans suppression logique, elles ne
// comptent plus une fois leur paiement supprimé).
const REPLACED_TABLES = [
  'transactions',
  'recurring_payments',
  'debts',
  'debt_repayments',
] as const satisfies readonly SoftDeletableTableName[];

/** Catégories locales incomplètes : l'import ne peut pas reprendre les 12 positions. */
export class MissingCategoriesError extends Error {
  constructor() {
    super('Catégories locales incomplètes');
    this.name = 'MissingCategoriesError';
  }
}

// Copie d'une ligne de la sauvegarde avec un nouvel id, sa date de création et ses références converties.
function copyRow<T extends SyncedTableName>(
  w: Writer,
  tableName: T,
  row: BackupRow<T>,
  refs: Partial<InsertValues<T>> = {},
): string {
  const {
    id: _id,
    createdAt,
    updatedAt: _updatedAt,
    ...values
  } = row as BackupRow<T> & { id: string; createdAt: string; updatedAt: string };
  return w.insert(tableName, { ...values, ...refs } as InsertValues<T>, { createdAt }).id;
}

/**
 * Remplace toutes les données du compte `userId` par celles de la sauvegarde (déjà validée), dans
 * une seule transaction : en cas d'erreur, rien n'est modifié. Les lignes actuelles sont supprimées
 * (logiquement, définitivement pour les personnes), puis toutes les lignes du fichier sont recréées
 * avec de nouveaux ids et leurs références converties ; les 12 catégories existantes prennent le nom,
 * la couleur et l'icône de la catégorie de même position. Tout part dans la file de synchro.
 */
export function importBackup(db: Database, userId: string, backup: Backup): void {
  const { rows } = backup;
  writeTransaction(db, userId, (w) => {
    for (const tableName of REPLACED_TABLES) {
      const table = syncedTables[tableName] as unknown as LooseTable;
      const ids = db
        .select({ id: table.id })
        .from(table)
        .where(and(eq(table.userId, userId), isNull(table.deletedAt)))
        .all();
      for (const { id } of ids) w.softDelete(tableName, id);
    }
    const people = db
      .select({ id: debtPeople.id })
      .from(debtPeople)
      .where(eq(debtPeople.userId, userId))
      .all();
    for (const { id } of people) w.hardDelete('debt_people', id);

    const localByPosition = new Map(
      db
        .select()
        .from(categories)
        .where(and(eq(categories.userId, userId), isNull(categories.deletedAt)))
        .all()
        .map((c) => [c.position, c]),
    );
    const categoryIds = new Map<string, string>();
    for (const c of rows.categories) {
      const local = localByPosition.get(c.position);
      if (!local) throw new MissingCategoriesError();
      categoryIds.set(c.id, local.id);
      if (local.name !== c.name || local.color !== c.color || local.icon !== c.icon) {
        w.update('categories', local.id, { name: c.name, color: c.color, icon: c.icon });
      }
    }
    const categoryOf = (id: string) => categoryIds.get(id) as string;

    const transactionIds = new Map<string, string>();
    for (const t of rows.transactions) {
      transactionIds.set(
        t.id,
        copyRow(w, 'transactions', t, {
          categoryId: t.categoryId === null ? null : categoryOf(t.categoryId),
        }),
      );
    }

    const paymentIds = new Map<string, string>();
    for (const p of rows.recurring_payments) {
      paymentIds.set(
        p.id,
        copyRow(w, 'recurring_payments', p, { categoryId: categoryOf(p.categoryId) }),
      );
    }
    // La dépense d'une occurrence peut avoir été supprimée avant l'export : id d'origine gardé.
    for (const o of rows.recurring_occurrences) {
      copyRow(w, 'recurring_occurrences', o, {
        recurringPaymentId: paymentIds.get(o.recurringPaymentId) as string,
        transactionId: transactionIds.get(o.transactionId) ?? o.transactionId,
      });
    }

    const personIds = new Map<string, string>();
    for (const p of rows.debt_people) personIds.set(p.id, copyRow(w, 'debt_people', p));
    const debtIds = new Map<string, string>();
    for (const d of rows.debts) {
      debtIds.set(d.id, copyRow(w, 'debts', d, { personId: personIds.get(d.personId) as string }));
    }
    for (const r of rows.debt_repayments) {
      copyRow(w, 'debt_repayments', r, { debtId: debtIds.get(r.debtId) as string });
    }
  });
}
