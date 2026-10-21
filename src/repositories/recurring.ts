import { and, asc, eq, isNull } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { recurringOccurrences, recurringPayments } from '@/db/schema';
import { periodOf, type RecurringValues } from '@/lib/recurring';
import {
  insertRow,
  RowNotFoundError,
  softDeleteRow,
  updateRow,
  writeTransaction,
  type SyncedRow,
} from '@/repositories/write';
import type { DuePayment, RecurringPayment, Transaction } from '@/types/budget';

// Paiements réguliers et occurrences payées : lectures réactives et écritures via l'outil commun.

const paymentColumns = {
  id: recurringPayments.id,
  name: recurringPayments.name,
  amountDa: recurringPayments.amountDa,
  categoryId: recurringPayments.categoryId,
  frequency: recurringPayments.frequency,
  dayOfMonth: recurringPayments.dayOfMonth,
  month: recurringPayments.month,
  startDate: recurringPayments.startDate,
  active: recurringPayments.active,
  note: recurringPayments.note,
  createdAt: recurringPayments.createdAt,
};

const visibleTo = (userId: string) =>
  and(eq(recurringPayments.userId, userId), isNull(recurringPayments.deletedAt));

/** Paiements réguliers non supprimés du compte, par nom (à passer à `useLiveQuery`). */
export function recurringPaymentsQuery(db: Database, userId: string) {
  return db
    .select(paymentColumns)
    .from(recurringPayments)
    .where(visibleTo(userId))
    .orderBy(asc(recurringPayments.name));
}

/** Un paiement régulier non supprimé du compte (0 ou 1 ligne, à passer à `useLiveQuery`). */
export function recurringPaymentQuery(db: Database, userId: string, id: string) {
  return db
    .select(paymentColumns)
    .from(recurringPayments)
    .where(and(visibleTo(userId), eq(recurringPayments.id, id)))
    .limit(1);
}

/** Échéances payées du compte (paiement, date d'échéance), à passer à `useLiveQuery`. */
export function paidOccurrencesQuery(db: Database, userId: string) {
  return db
    .select({
      recurringPaymentId: recurringOccurrences.recurringPaymentId,
      dueDate: recurringOccurrences.dueDate,
    })
    .from(recurringOccurrences)
    .where(eq(recurringOccurrences.userId, userId));
}

/** Regroupe les dates d'échéance payées par paiement. */
export function groupPaidDueDates(
  rows: readonly { recurringPaymentId: string; dueDate: string }[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const list = map.get(r.recurringPaymentId);
    if (list) list.push(r.dueDate);
    else map.set(r.recurringPaymentId, [r.dueDate]);
  }
  return map;
}

const toPayment = (row: SyncedRow<'recurring_payments'>): RecurringPayment => ({
  id: row.id,
  name: row.name,
  amountDa: row.amountDa,
  categoryId: row.categoryId,
  frequency: row.frequency,
  dayOfMonth: row.dayOfMonth,
  month: row.month,
  startDate: row.startDate,
  active: row.active,
  note: row.note,
  createdAt: row.createdAt,
});

/** Crée un paiement régulier (et son entrée `sync_queue`). */
export function createRecurringPayment(
  db: Database,
  userId: string,
  values: RecurringValues,
): RecurringPayment {
  return toPayment(insertRow(db, 'recurring_payments', userId, values));
}

/**
 * Modifie un paiement ; `RowNotFoundError` s'il est supprimé ou d'un autre compte. Les occurrences
 * et dépenses déjà enregistrées ne sont jamais touchées.
 */
export function updateRecurringPayment(
  db: Database,
  userId: string,
  id: string,
  values: RecurringValues,
): RecurringPayment {
  return toPayment(updateRow(db, 'recurring_payments', userId, id, values));
}

/** Suppression logique ; les occurrences et dépenses déjà enregistrées sont conservées. */
export function deleteRecurringPayment(db: Database, userId: string, id: string): void {
  softDeleteRow(db, 'recurring_payments', userId, id);
}

/** L'échéance (ou une autre de la même période) est déjà payée, ex. depuis un autre appareil. */
export class AlreadyPaidError extends Error {
  constructor() {
    super('Échéance déjà payée');
    this.name = 'AlreadyPaidError';
  }
}

/**
 * « J'ai payé » : crée la dépense (catégorie et montant du paiement, nom en note, date de
 * paiement) et l'occurrence dans une même transaction SQLite. `RowNotFoundError` si le paiement
 * n'existe plus, `AlreadyPaidError` si la période est déjà couverte.
 */
export function payDue(
  db: Database,
  userId: string,
  due: Pick<DuePayment, 'dueDate'> & { paymentId: string },
  paidAt: string,
): Transaction {
  const payment = recurringPaymentQuery(db, userId, due.paymentId).get();
  if (!payment) throw new RowNotFoundError('recurring_payments');
  const period = periodOf(payment.frequency, due.dueDate);
  const alreadyPaid = db
    .select({ dueDate: recurringOccurrences.dueDate })
    .from(recurringOccurrences)
    .where(
      and(
        eq(recurringOccurrences.userId, userId),
        eq(recurringOccurrences.recurringPaymentId, payment.id),
      ),
    )
    .all()
    .some((o) => periodOf(payment.frequency, o.dueDate) === period);
  if (alreadyPaid) throw new AlreadyPaidError();

  return writeTransaction(db, userId, (w) => {
    const expense = w.insert('transactions', {
      type: 'expense',
      amountDa: payment.amountDa,
      currency: 'DZD',
      originalAmountCents: null,
      eurRate: null,
      categoryId: payment.categoryId,
      note: payment.name,
      date: paidAt,
    });
    w.insert('recurring_occurrences', {
      recurringPaymentId: payment.id,
      dueDate: due.dueDate,
      paidAt,
      transactionId: expense.id,
    });
    return {
      id: expense.id,
      type: expense.type,
      amountDa: expense.amountDa,
      currency: expense.currency,
      originalAmountCents: expense.originalAmountCents,
      eurRate: expense.eurRate,
      categoryId: expense.categoryId,
      note: expense.note,
      date: expense.date,
      createdAt: expense.createdAt,
    };
  });
}
