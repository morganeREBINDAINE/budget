import { and, asc, desc, eq, isNull, ne, sql } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { debtPeople, debtRepayments, debts } from '@/db/schema';
import { findPerson, type DebtValues, type RepaymentValues } from '@/lib/debts';
import {
  RowNotFoundError,
  softDeleteRow,
  updateRow,
  writeTransaction,
  type Writer,
} from '@/repositories/write';
import type { Debt, DebtDirection, DebtRepayment } from '@/types/budget';

// Dettes, personnes et remboursements : lectures réactives et écritures via l'outil commun.
// Une personne n'existe que tant qu'une dette la référence : créée (ou restaurée) à
// l'enregistrement d'une dette, supprimée quand sa dernière dette disparaît ou change de personne.
// L'index unique des noms compte aussi les personnes supprimées : un nom déjà connu est restauré.

const moneyColumns = <T extends typeof debts | typeof debtRepayments>(t: T) => ({
  id: t.id,
  amountDa: t.amountDa,
  currency: t.currency,
  originalAmountCents: t.originalAmountCents,
  eurRate: t.eurRate,
  date: t.date,
  note: t.note,
  createdAt: t.createdAt,
});

const debtColumns = {
  ...moneyColumns(debts),
  direction: debts.direction,
  personId: debts.personId,
};
const repaymentColumns = { ...moneyColumns(debtRepayments), debtId: debtRepayments.debtId };

const visibleDebts = (userId: string) => and(eq(debts.userId, userId), isNull(debts.deletedAt));
const visibleRepayments = (userId: string) =>
  and(eq(debtRepayments.userId, userId), isNull(debtRepayments.deletedAt));

/** Dettes non supprimées d'un sens, plus récentes d'abord (à passer à `useLiveQuery`). */
export function debtsQuery(db: Database, userId: string, direction: DebtDirection) {
  return db
    .select(debtColumns)
    .from(debts)
    .where(and(visibleDebts(userId), eq(debts.direction, direction)))
    .orderBy(desc(debts.date), desc(debts.createdAt));
}

/** Une dette non supprimée du compte (0 ou 1 ligne). */
export function debtQuery(db: Database, userId: string, id: string) {
  return db
    .select(debtColumns)
    .from(debts)
    .where(and(visibleDebts(userId), eq(debts.id, id)))
    .limit(1);
}

/** Personnes non supprimées du compte, par nom (autocomplétion, noms des dettes). */
export function peopleQuery(db: Database, userId: string) {
  return db
    .select({ id: debtPeople.id, name: debtPeople.name })
    .from(debtPeople)
    .where(and(eq(debtPeople.userId, userId), isNull(debtPeople.deletedAt)))
    .orderBy(asc(debtPeople.name));
}

/** Total remboursé par dette (remboursements non supprimés), calculé par SQLite. */
export function repaidByDebtQuery(db: Database, userId: string) {
  return db
    .select({
      debtId: debtRepayments.debtId,
      repaidDa: sql<number>`sum(${debtRepayments.amountDa})`.mapWith(Number),
    })
    .from(debtRepayments)
    .where(visibleRepayments(userId))
    .groupBy(debtRepayments.debtId);
}

/** Remboursements non supprimés d'une dette, plus récents d'abord. */
export function debtRepaymentsQuery(db: Database, userId: string, debtId: string) {
  return db
    .select(repaymentColumns)
    .from(debtRepayments)
    .where(and(visibleRepayments(userId), eq(debtRepayments.debtId, debtId)))
    .orderBy(desc(debtRepayments.date), desc(debtRepayments.createdAt));
}

/** Un remboursement non supprimé du compte (0 ou 1 ligne). */
export function repaymentQuery(db: Database, userId: string, id: string) {
  return db
    .select(repaymentColumns)
    .from(debtRepayments)
    .where(and(visibleRepayments(userId), eq(debtRepayments.id, id)))
    .limit(1);
}

// Id de la personne portant ce nom : existante, restaurée si supprimée, sinon créée.
function resolvePerson(db: Database, userId: string, w: Writer, name: string): string {
  const all = db
    .select({ id: debtPeople.id, name: debtPeople.name, deletedAt: debtPeople.deletedAt })
    .from(debtPeople)
    .where(eq(debtPeople.userId, userId))
    .all();
  const active = findPerson(
    all.filter((p) => p.deletedAt === null),
    name,
  );
  if (active) return active.id;
  const deleted = findPerson(
    all.filter((p) => p.deletedAt !== null),
    name,
  );
  if (deleted) {
    w.restore('debt_people', deleted.id);
    if (deleted.name !== name) w.update('debt_people', deleted.id, { name });
    return deleted.id;
  }
  return w.insert('debt_people', { name }).id;
}

// Supprime la personne si aucune autre dette (hors `exceptDebtId`) ne la référence.
function dropPersonIfUnused(
  db: Database,
  userId: string,
  w: Writer,
  personId: string,
  exceptDebtId: string,
) {
  const other = db
    .select({ id: debts.id })
    .from(debts)
    .where(and(visibleDebts(userId), eq(debts.personId, personId), ne(debts.id, exceptDebtId)))
    .limit(1)
    .get();
  if (other) return;
  try {
    w.softDelete('debt_people', personId);
  } catch (error) {
    // Déjà supprimée (ex. par une synchro) : rien à faire.
    if (!(error instanceof RowNotFoundError)) throw error;
  }
}

const debtRow = ({ personName: _personName, ...values }: DebtValues) => values;

/** Crée une dette (et sa personne si besoin) dans une même transaction. */
export function createDebt(
  db: Database,
  userId: string,
  direction: DebtDirection,
  values: DebtValues,
): Debt {
  return writeTransaction(db, userId, (w) => {
    const personId = resolvePerson(db, userId, w, values.personName);
    const row = w.insert('debts', { ...debtRow(values), direction, personId });
    return { ...row, personId };
  });
}

/**
 * Modifie une dette (sens inchangé). Un autre nom la rattache à une autre personne (existante ou
 * créée), sans renommer l'ancienne, supprimée si elle n'a plus de dette.
 */
export function updateDebt(db: Database, userId: string, id: string, values: DebtValues): Debt {
  const existing = debtQuery(db, userId, id).get();
  if (!existing) throw new RowNotFoundError('debts');
  return writeTransaction(db, userId, (w) => {
    const personId = resolvePerson(db, userId, w, values.personName);
    const row = w.update('debts', id, { ...debtRow(values), personId });
    if (personId !== existing.personId) dropPersonIfUnused(db, userId, w, existing.personId, id);
    return row;
  });
}

/** Supprime une dette, ses remboursements et sa personne si elle n'a plus de dette. */
export function deleteDebt(db: Database, userId: string, id: string): void {
  const existing = debtQuery(db, userId, id).get();
  if (!existing) throw new RowNotFoundError('debts');
  const repayments = debtRepaymentsQuery(db, userId, id).all();
  writeTransaction(db, userId, (w) => {
    for (const r of repayments) w.softDelete('debt_repayments', r.id);
    w.softDelete('debts', id);
    dropPersonIfUnused(db, userId, w, existing.personId, id);
  });
}

/** Ajoute un remboursement ; `RowNotFoundError` si la dette n'existe plus. */
export function createRepayment(
  db: Database,
  userId: string,
  debtId: string,
  values: RepaymentValues,
): DebtRepayment {
  if (!debtQuery(db, userId, debtId).get()) throw new RowNotFoundError('debts');
  return writeTransaction(db, userId, (w) => w.insert('debt_repayments', { ...values, debtId }));
}

/** Modifie un remboursement ; `RowNotFoundError` s'il est supprimé ou d'un autre compte. */
export function updateRepayment(
  db: Database,
  userId: string,
  id: string,
  values: RepaymentValues,
): DebtRepayment {
  return updateRow(db, 'debt_repayments', userId, id, values);
}

/** Suppression logique d'un remboursement (le reste dû augmente d'autant). */
export function deleteRepayment(db: Database, userId: string, id: string): void {
  softDeleteRow(db, 'debt_repayments', userId, id);
}
