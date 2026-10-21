import type { Category, Transaction } from '@/types/budget';

export type CategoryTotal = { category: Category; amountDa: number };

export type MonthSummary = {
  // Transactions du mois, dans l'ordre reçu (date desc puis création desc).
  transactions: Transaction[];
  categoriesById: Map<string, Category>;
  incomeDa: number;
  incomeCount: number;
  expenseDa: number;
  expenseCount: number;
  // Dépenses par catégorie (montant > 0), de la plus grosse à la plus petite.
  byCategory: CategoryTotal[];
  // Dépenses dont la catégorie est introuvable (données incohérentes) : comptées dans
  // `expenseDa`, absentes de `byCategory`, signalées sous le graphique.
  orphanExpenses: Transaction[];
};

const sum = (list: Transaction[]) => list.reduce((acc, t) => acc + t.amountDa, 0);

/** Totaux d'un mois à partir de ses transactions et des catégories du compte. */
export function summarizeMonth(transactions: Transaction[], categories: Category[]): MonthSummary {
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const incomes = transactions.filter((t) => t.type === 'income');
  const expenses = transactions.filter((t) => t.type === 'expense');

  const totals = new Map<string, number>();
  const orphanExpenses: Transaction[] = [];
  for (const t of expenses) {
    if (t.categoryId && categoriesById.has(t.categoryId)) {
      totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amountDa);
    } else {
      orphanExpenses.push(t);
    }
  }

  const byCategory = categories
    .map((category) => ({ category, amountDa: totals.get(category.id) ?? 0 }))
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
    orphanExpenses,
  };
}
