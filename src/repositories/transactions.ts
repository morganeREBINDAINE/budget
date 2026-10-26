import { and, desc, eq, gte, isNull, lt } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { transactions } from '@/db/schema';
import { monthBounds, yearWindowBounds, type YearMonth } from '@/lib/format';
import type { TransactionValues } from '@/lib/transactions';
import { insertRow, softDeleteRow, updateRow, type SyncedRow } from '@/repositories/write';
import type { Transaction } from '@/types/budget';

// Entrées et dépenses du compte : lectures réactives et écritures via l'outil commun.

const transactionColumns = {
  id: transactions.id,
  type: transactions.type,
  amountDa: transactions.amountDa,
  currency: transactions.currency,
  originalAmountCents: transactions.originalAmountCents,
  eurRate: transactions.eurRate,
  categoryId: transactions.categoryId,
  note: transactions.note,
  date: transactions.date,
  createdAt: transactions.createdAt,
};

const visibleTo = (userId: string) =>
  and(eq(transactions.userId, userId), isNull(transactions.deletedAt));

/**
 * Transactions non supprimées du compte pour un mois, de la plus récente à la plus ancienne
 * (date desc puis création desc). À passer à `useLiveQuery`.
 */
export function monthTransactionsQuery(db: Database, userId: string, month: YearMonth) {
  return periodTransactionsQuery(db, userId, monthBounds(month));
}

/**
 * Transactions non supprimées du compte sur les 12 mois finissant à `end` inclus (vue à l'année),
 * même tri que `monthTransactionsQuery`. À passer à `useLiveQuery`.
 */
export function yearTransactionsQuery(db: Database, userId: string, end: YearMonth) {
  return periodTransactionsQuery(db, userId, yearWindowBounds(end));
}

// Dates dans [start, end[ (YYYY-MM-DD), sur l'index (user_id, date).
function periodTransactionsQuery(
  db: Database,
  userId: string,
  { start, end }: { start: string; end: string },
) {
  return db
    .select(transactionColumns)
    .from(transactions)
    .where(and(visibleTo(userId), gte(transactions.date, start), lt(transactions.date, end)))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));
}

/** Une transaction non supprimée du compte (0 ou 1 ligne, à passer à `useLiveQuery`). */
export function transactionQuery(db: Database, userId: string, id: string) {
  return db
    .select(transactionColumns)
    .from(transactions)
    .where(and(visibleTo(userId), eq(transactions.id, id)))
    .limit(1);
}

const toTransaction = (row: SyncedRow<'transactions'>): Transaction => ({
  id: row.id,
  type: row.type,
  amountDa: row.amountDa,
  currency: row.currency,
  originalAmountCents: row.originalAmountCents,
  eurRate: row.eurRate,
  categoryId: row.categoryId,
  note: row.note,
  date: row.date,
  createdAt: row.createdAt,
});

/** Crée une entrée ou une dépense (et son entrée `sync_queue`). */
export function createTransaction(
  db: Database,
  userId: string,
  values: TransactionValues,
): Transaction {
  return toTransaction(insertRow(db, 'transactions', userId, values));
}

/** Modifie une transaction ; `RowNotFoundError` si elle est supprimée ou d'un autre compte. */
export function updateTransaction(
  db: Database,
  userId: string,
  id: string,
  values: TransactionValues,
): Transaction {
  return toTransaction(updateRow(db, 'transactions', userId, id, values));
}

/** Suppression logique ; `RowNotFoundError` si elle est déjà supprimée ou d'un autre compte. */
export function deleteTransaction(db: Database, userId: string, id: string): void {
  softDeleteRow(db, 'transactions', userId, id);
}
