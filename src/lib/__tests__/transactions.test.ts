import {
  isUnchanged,
  NOTE_MAX_LENGTH,
  validateTransaction,
  type TransactionInput,
} from '@/lib/transactions';
import type { Transaction } from '@/types/budget';

const TODAY = '2026-10-21';
const context = { today: TODAY, categoryIds: new Set(['cat-1']) };

const expense = (overrides: Partial<TransactionInput> = {}): TransactionInput => ({
  type: 'expense',
  amount: '1500',
  currency: 'DZD',
  rate: '',
  date: TODAY,
  categoryId: 'cat-1',
  note: '',
  ...overrides,
});

describe('validateTransaction', () => {
  it('renvoie les valeurs à enregistrer pour une dépense valide', () => {
    expect(validateTransaction(expense({ note: '  Courses  ' }), context)).toEqual({
      ok: true,
      values: {
        type: 'expense',
        amountDa: 1500,
        currency: 'DZD',
        originalAmountCents: null,
        eurRate: null,
        categoryId: 'cat-1',
        note: 'Courses',
        date: TODAY,
      },
    });
  });

  it('note vide → null, note tronquée à la longueur maximale', () => {
    const empty = validateTransaction(expense({ note: '   ' }), context);
    expect(empty.ok && empty.values.note).toBeNull();
    const long = validateTransaction(expense({ note: 'a'.repeat(NOTE_MAX_LENGTH + 5) }), context);
    expect(long.ok && long.values.note).toHaveLength(NOTE_MAX_LENGTH);
  });

  it('exige une catégorie existante pour une dépense', () => {
    expect(validateTransaction(expense({ categoryId: null }), context)).toEqual({
      ok: false,
      errors: { category: 'Choisis une catégorie.' },
    });
    expect(validateTransaction(expense({ categoryId: 'supprimée' }), context)).toEqual({
      ok: false,
      errors: { category: 'Choisis une catégorie.' },
    });
  });

  it("n'enregistre jamais de catégorie pour une entrée", () => {
    const result = validateTransaction(expense({ type: 'income', categoryId: 'cat-1' }), context);
    expect(result.ok && result.values.categoryId).toBeNull();
  });

  it('refuse une date dans le futur, accepte aujourd’hui et le passé', () => {
    expect(validateTransaction(expense({ date: '2026-10-22' }), context)).toEqual({
      ok: false,
      errors: { date: 'La date ne peut pas être dans le futur.' },
    });
    expect(validateTransaction(expense({ date: '2025-01-31' }), context).ok).toBe(true);
  });

  it('cumule les erreurs de montant, de taux, de date et de catégorie', () => {
    const result = validateTransaction(
      expense({ amount: '', currency: 'EUR', rate: '', date: '2027-01-01', categoryId: null }),
      context,
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        amount: 'Saisis un montant supérieur à 0.',
        rate: 'Saisis un taux supérieur à 0.',
        date: 'La date ne peut pas être dans le futur.',
        category: 'Choisis une catégorie.',
      },
    });
  });

  it('convertit une saisie en EUR', () => {
    const result = validateTransaction(
      expense({ amount: '10', currency: 'EUR', rate: '250' }),
      context,
    );
    expect(result.ok && result.values).toMatchObject({
      amountDa: 2500,
      currency: 'EUR',
      originalAmountCents: 1000,
      eurRate: 250,
    });
  });
});

describe('isUnchanged', () => {
  const existing: Transaction = {
    id: 'tx-1',
    type: 'expense',
    amountDa: 1500,
    currency: 'DZD',
    originalAmountCents: null,
    eurRate: null,
    categoryId: 'cat-1',
    note: null,
    date: TODAY,
    createdAt: '2026-10-21T08:00:00.000Z',
  };

  it('détecte une saisie identique et une modification', () => {
    const same = validateTransaction(expense(), context);
    const changed = validateTransaction(expense({ amount: '1600' }), context);
    if (!same.ok || !changed.ok) throw new Error('saisie invalide');
    expect(isUnchanged(existing, same.values)).toBe(true);
    expect(isUnchanged(existing, changed.values)).toBe(false);
  });
});
