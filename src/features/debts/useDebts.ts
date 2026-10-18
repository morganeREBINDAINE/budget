import { useMemo } from 'react';

import { remainingDa, repaidDa } from '@/lib/debts';
import { mockDebtPeople, mockDebtRepayments, mockDebts } from '@/mocks/debts';
import type { Debt, DebtDirection, DebtPerson } from '@/types/budget';

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

const byDateDesc = (a: DebtItem, b: DebtItem) =>
  b.debt.date.localeCompare(a.debt.date) || b.debt.createdAt.localeCompare(a.debt.createdAt);

// Dettes d'un sens : en cours puis soldées, plus récentes d'abord (mocks en phase 2, SQLite en phase 3).
export function useDebts(direction: DebtDirection): DebtsSummary {
  return useMemo(() => {
    const people = new Map(mockDebtPeople.map((p) => [p.id, p]));
    const items = mockDebts
      .filter((d) => d.direction === direction)
      .map((debt) => ({
        debt,
        person: people.get(debt.personId),
        repaidDa: repaidDa(debt.id, mockDebtRepayments),
        remainingDa: remainingDa(debt, mockDebtRepayments),
      }))
      .sort(byDateDesc);
    const active = items.filter((i) => i.remainingDa > 0);
    return {
      active,
      settled: items.filter((i) => i.remainingDa === 0),
      totalRemainingDa: active.reduce((acc, i) => acc + i.remainingDa, 0),
    };
  }, [direction]);
}
