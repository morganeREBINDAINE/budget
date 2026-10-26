import { useMemo } from 'react';

import type { LiveData } from '@/db/liveData';
import { useMonthTransactions, useYearTransactions } from '@/features/transaction/useTransactions';
import { summarizeMonth, type MonthSummary } from '@/lib/budget';
import type { YearMonth } from '@/lib/format';
import type { Category, Transaction } from '@/types/budget';

/** Totaux du mois affiché, recalculés à chaque changement de ses transactions ou des catégories. */
export function useMonthSummary(
  month: YearMonth,
  categories: LiveData<Category[]>,
): LiveData<MonthSummary> {
  return useSummary(useMonthTransactions(month), categories);
}

/** Totaux des 12 mois finissant à `end` inclus (vue à l'année), recalculés en direct. */
export function useYearSummary(
  end: YearMonth,
  categories: LiveData<Category[]>,
): LiveData<MonthSummary> {
  return useSummary(useYearTransactions(end), categories);
}

function useSummary(
  transactions: LiveData<Transaction[]>,
  categories: LiveData<Category[]>,
): LiveData<MonthSummary> {
  return useMemo(() => {
    if (transactions.status === 'error' || categories.status === 'error')
      return { status: 'error' };
    if (transactions.status === 'loading' || categories.status === 'loading') {
      return { status: 'loading' };
    }
    return { status: 'ready', data: summarizeMonth(transactions.data, categories.data) };
  }, [transactions, categories]);
}
