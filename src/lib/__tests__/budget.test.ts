import { summarizeMonth } from '@/lib/budget';
import type { Category, Transaction } from '@/types/budget';

const category = (id: string, position: number): Category => ({
  id,
  name: id,
  color: '#EF4444',
  icon: 'car',
  position,
});

const voiture = category('voiture', 1);
const maison = category('maison', 2);
const loisirs = category('loisirs', 3);

let seq = 0;
const tx = (
  type: Transaction['type'],
  amountDa: number,
  categoryId: string | null = null,
): Transaction => {
  seq += 1;
  return {
    id: `tx-${seq}`,
    type,
    amountDa,
    currency: 'DZD',
    originalAmountCents: null,
    eurRate: null,
    categoryId,
    note: null,
    date: '2026-10-10',
    createdAt: '2026-10-10T08:00:00.000Z',
  };
};

describe('summarizeMonth', () => {
  it('mois vide : totaux à zéro, rien par catégorie', () => {
    expect(summarizeMonth([], [voiture])).toMatchObject({
      transactions: [],
      incomeDa: 0,
      incomeCount: 0,
      expenseDa: 0,
      expenseCount: 0,
      byCategory: [],
      orphanExpenses: [],
    });
  });

  it('totaux des entrées et des dépenses, par catégorie du plus gros au plus petit', () => {
    const transactions = [
      tx('income', 280000),
      tx('expense', 3500, 'voiture'),
      tx('expense', 25000, 'maison'),
      tx('income', 40000),
      tx('expense', 1500, 'voiture'),
    ];
    const summary = summarizeMonth(transactions, [voiture, maison, loisirs]);

    expect(summary.transactions).toBe(transactions);
    expect(summary).toMatchObject({
      incomeDa: 320000,
      incomeCount: 2,
      expenseDa: 30000,
      expenseCount: 3,
      orphanExpenses: [],
    });
    expect(summary.byCategory).toEqual([
      { category: maison, amountDa: 25000 },
      { category: voiture, amountDa: 5000 },
    ]);
    expect(summary.categoriesById.get('voiture')).toBe(voiture);
  });

  it('dépense sans catégorie valide : comptée dans le total, hors graphique, signalée', () => {
    const orphan = tx('expense', 700, 'supprimée');
    const summary = summarizeMonth([tx('expense', 300, 'voiture'), orphan], [voiture]);

    expect(summary.expenseDa).toBe(1000);
    expect(summary.expenseCount).toBe(2);
    expect(summary.byCategory).toEqual([{ category: voiture, amountDa: 300 }]);
    expect(summary.orphanExpenses).toEqual([orphan]);
  });
});
