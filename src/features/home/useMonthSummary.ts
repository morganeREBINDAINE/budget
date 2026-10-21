import { useMemo } from 'react';

import type { LiveData } from '@/db/liveData';
import { useMonthTransactions } from '@/features/transaction/useTransactions';
import { summarizeMonth, type MonthSummary } from '@/lib/budget';
import type { YearMonth } from '@/lib/format';
import type { Category } from '@/types/budget';

/** Totaux du mois affiché, recalculés à chaque changement de ses transactions ou des catégories. */
export function useMonthSummary(
  month: YearMonth,
  categories: LiveData<Category[]>,
): LiveData<MonthSummary> {
  const transactions = useMonthTransactions(month);
  return useMemo(() => {
    if (transactions.status === 'error' || categories.status === 'error')
      return { status: 'error' };
    if (transactions.status === 'loading' || categories.status === 'loading') {
      return { status: 'loading' };
    }
    return { status: 'ready', data: summarizeMonth(transactions.data, categories.data) };
  }, [transactions, categories]);
}
