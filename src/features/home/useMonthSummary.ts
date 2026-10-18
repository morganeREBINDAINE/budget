import { useMemo } from 'react';

import { isInMonth, type YearMonth } from '@/lib/format';
import { mockCategories, mockTransactions } from '@/mocks/budget';
import type { Category, Transaction } from '@/types/budget';

import type { CategoryTotal } from './components/CategoryChart';

export type MonthSummary = {
  transactions: Transaction[];
  categoriesById: Map<string, Category>;
  incomeDa: number;
  incomeCount: number;
  expenseDa: number;
  expenseCount: number;
  byCategory: CategoryTotal[];
};

// Données du mois affiché (mocks en phase 2, SQLite en phase 3).
export function useMonthSummary(month: YearMonth): MonthSummary {
  return useMemo(() => {
    const transactions = mockTransactions
      .filter((t) => isInMonth(t.date, month))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

    const categoriesById = new Map(mockCategories.map((c) => [c.id, c]));
    const incomes = transactions.filter((t) => t.type === 'income');
    const expenses = transactions.filter((t) => t.type === 'expense');
    const sum = (list: Transaction[]) => list.reduce((acc, t) => acc + t.amountDa, 0);

    const byCategory = mockCategories
      .map((category) => ({
        category,
        amountDa: sum(expenses.filter((t) => t.categoryId === category.id)),
      }))
      .filter((c) => c.amountDa > 0)
      .sort((a, b) => b.amountDa - a.amountDa);

    return {
      transactions,
      categoriesById,
      incomeDa: sum(incomes),
      incomeCount: incomes.length,
      expenseDa: sum(expenses),
      expenseCount: expenses.length,
      byCategory,
    };
  }, [month]);
}
