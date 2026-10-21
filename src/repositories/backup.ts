import { and, asc, eq, getTableColumns, isNull, type SQL } from 'drizzle-orm';

import type { Backup, BackupRows } from '@/backup/format';
import type { Database } from '@/db/client';
import { SYNCED_TABLES, syncedTables } from '@/db/schema';

// Lecture de toutes les données du compte pour la sauvegarde JSON (`src/backup/format.ts`).

// Requêtes génériques : Drizzle ne sait pas typer une union de tables.
type LooseTable = (typeof syncedTables)['categories'];

/**
 * Lignes non supprimées du compte `userId`, sans `user_id` ni `deleted_at`, triées par date de
 * création. Les occurrences d'un paiement régulier supprimé ne sont pas exportées (inutiles sans
 * leur paiement).
 */
export function readBackup(
  db: Database,
  userId: string,
  accountEmail: string | null,
  now = new Date(),
): Backup {
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

  return {
    exportedAt: now.toISOString(),
    userId,
    accountEmail,
    rows: rows as unknown as BackupRows,
  };
}
