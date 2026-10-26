import { useMemo } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { type LiveData, useReportReadError } from '@/db/liveData';
import { useLiveQuery } from '@/db/useLiveQuery';
import { useUserId } from '@/features/auth/AuthProvider';
import { remainingOf } from '@/lib/debts';
import {
  debtQuery,
  debtRepaymentsQuery,
  debtsQuery,
  peopleQuery,
  repaidByDebtQuery,
  repaymentQuery,
} from '@/repositories/debts';
import type { Debt, DebtDirection, DebtPerson, DebtRepayment } from '@/types/budget';

const READ_ERROR = 'Impossible de lire les dettes.';

export type DebtItem = {
  debt: Debt;
  person: DebtPerson | undefined;
  repaidDa: number;
  remainingDa: number;
};

export type DebtsSummary = {
  active: DebtItem[];
  settled: DebtItem[];
  totalRemainingDa: number;
};

// Requête réactive → LiveData (journal + toast si la lecture locale échoue).
function useLive<T, R>(
  query: Parameters<typeof useLiveQuery>[0],
  select: (rows: T[]) => R,
): LiveData<R> {
  const { data, error, updatedAt } = useLiveQuery(query, [query]);
  useReportReadError(error, READ_ERROR);
  return useMemo(() => {
    if (error) return { status: 'error' };
    if (!updatedAt) return { status: 'loading' };
    return { status: 'ready', data: select(data as T[]) };
    // `select` est une fonction stable (définie hors des composants).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, error, updatedAt]);
}

const identity = <T>(rows: T[]) => rows;
const first = <T>(rows: T[]) => rows[0];
const toRepaidMap = (rows: { debtId: string; repaidDa: number }[]) =>
  new Map(rows.map((r) => [r.debtId, r.repaidDa]));

/** Personnes du compte connecté, par nom, en direct. */
export function useDebtPeople(): LiveData<DebtPerson[]> {
  const db = useDatabase();
  const userId = useUserId();
  const query = useMemo(() => peopleQuery(db, userId), [db, userId]);
  return useLive<DebtPerson, DebtPerson[]>(query, identity);
}

/** Dettes d'un sens : en cours puis soldées, plus récentes d'abord, avec le reste dû. */
export function useDebts(direction: DebtDirection): LiveData<DebtsSummary> {
  const db = useDatabase();
  const userId = useUserId();
  const debtsQ = useMemo(() => debtsQuery(db, userId, direction), [db, userId, direction]);
  const repaidQ = useMemo(() => repaidByDebtQuery(db, userId), [db, userId]);
  const list = useLive<Debt, Debt[]>(debtsQ, identity);
  const repaid = useLive(repaidQ, toRepaidMap);
  const people = useDebtPeople();

  return useMemo(() => {
    if (list.status === 'error' || repaid.status === 'error' || people.status === 'error')
      return { status: 'error' };
    if (list.status === 'loading' || repaid.status === 'loading' || people.status === 'loading')
      return { status: 'loading' };
    const byId = new Map(people.data.map((p) => [p.id, p]));
    const items = list.data.map((debt) => {
      const repaidDa = repaid.data.get(debt.id) ?? 0;
      return {
        debt,
        person: byId.get(debt.personId),
        repaidDa,
        remainingDa: remainingOf(debt.amountDa, repaidDa),
      };
    });
    const active = items.filter((i) => i.remainingDa > 0);
    return {
      status: 'ready',
      data: {
        active,
        settled: items.filter((i) => i.remainingDa === 0),
        totalRemainingDa: active.reduce((acc, i) => acc + i.remainingDa, 0),
      },
    };
  }, [list, repaid, people]);
}

/** Une dette du compte connecté (`undefined` si introuvable ou supprimée), en direct. */
export function useDebt(id: string): LiveData<Debt | undefined> {
  const db = useDatabase();
  const userId = useUserId();
  const query = useMemo(() => debtQuery(db, userId, id), [db, userId, id]);
  return useLive<Debt, Debt | undefined>(query, first);
}

/** Remboursements d'une dette, plus récents d'abord, en direct. */
export function useDebtRepayments(debtId: string): LiveData<DebtRepayment[]> {
  const db = useDatabase();
  const userId = useUserId();
  const query = useMemo(() => debtRepaymentsQuery(db, userId, debtId), [db, userId, debtId]);
  return useLive<DebtRepayment, DebtRepayment[]>(query, identity);
}

/** Un remboursement (`undefined` si introuvable ou supprimé), en direct. */
export function useRepayment(id: string): LiveData<DebtRepayment | undefined> {
  const db = useDatabase();
  const userId = useUserId();
  const query = useMemo(() => repaymentQuery(db, userId, id), [db, userId, id]);
  return useLive<DebtRepayment, DebtRepayment | undefined>(query, first);
}
