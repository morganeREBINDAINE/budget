import {
  findPerson,
  isDebtUnchanged,
  isRepaymentUnchanged,
  remainingOf,
  validateDebt,
  validateRepayment,
  type DebtInput,
} from '@/lib/debts';
import type { Debt, DebtRepayment } from '@/types/budget';

const TODAY = '2026-10-21';

const debtInput = (overrides: Partial<DebtInput> = {}): DebtInput => ({
  person: '  Karim ',
  amount: '10000',
  currency: 'DZD',
  rate: '',
  date: '2026-10-01',
  note: ' ',
  ...overrides,
});

describe('remainingOf', () => {
  it('montant − remboursé, jamais négatif', () => {
    expect(remainingOf(10000, 2500)).toBe(7500);
    expect(remainingOf(10000, 10000)).toBe(0);
    expect(remainingOf(10000, 12000)).toBe(0);
  });
});

describe('findPerson', () => {
  const people = [
    { id: '1', name: 'Amel Haddad' },
    { id: '2', name: 'Karim' },
  ];
  it('insensible à la casse, aux accents et aux espaces autour', () => {
    expect(findPerson(people, '  karim ')?.id).toBe('2');
    expect(findPerson(people, 'AMÉL HADDAD')?.id).toBe('1');
    expect(findPerson(people, 'Kar')).toBeUndefined();
  });
});

describe('validateDebt', () => {
  it('valeurs nettoyées en DA', () => {
    expect(validateDebt(debtInput(), { today: TODAY, repaidDa: 0 })).toEqual({
      ok: true,
      values: {
        personName: 'Karim',
        amountDa: 10000,
        currency: 'DZD',
        originalAmountCents: null,
        eurRate: null,
        date: '2026-10-01',
        note: null,
      },
    });
  });

  it('EUR : montant converti au taux saisi', () => {
    const result = validateDebt(debtInput({ amount: '100,5', currency: 'EUR', rate: '250' }), {
      today: TODAY,
      repaidDa: 0,
    });
    expect(result).toMatchObject({
      ok: true,
      values: { amountDa: 25125, currency: 'EUR', originalAmountCents: 10050, eurRate: 250 },
    });
  });

  it('personne requise, date future refusée, taux requis en EUR', () => {
    expect(
      validateDebt(debtInput({ person: ' ', date: '2026-10-22', currency: 'EUR', rate: '' }), {
        today: TODAY,
        repaidDa: 0,
      }),
    ).toEqual({
      ok: false,
      errors: {
        person: 'Saisis le nom de la personne.',
        date: 'La date ne peut pas être dans le futur.',
        rate: 'Saisis un taux supérieur à 0.',
      },
    });
  });

  it('date passée acceptée', () => {
    expect(validateDebt(debtInput({ date: '2019-01-01' }), { today: TODAY, repaidDa: 0 }).ok).toBe(
      true,
    );
  });

  it('montant inférieur au total déjà remboursé refusé, égal accepté', () => {
    const ko = validateDebt(debtInput({ amount: '4999' }), { today: TODAY, repaidDa: 5000 });
    expect(ko.ok).toBe(false);
    expect(!ko.ok && ko.errors.amount).toMatch(/inférieur au total déjà remboursé/);
    expect(validateDebt(debtInput({ amount: '5000' }), { today: TODAY, repaidDa: 5000 }).ok).toBe(
      true,
    );
  });

  it('nom de plus de 40 caractères refusé', () => {
    expect(
      validateDebt(debtInput({ person: 'x'.repeat(41) }), { today: TODAY, repaidDa: 0 }),
    ).toMatchObject({ errors: { person: '40 caractères maximum.' } });
  });
});

describe('validateRepayment', () => {
  const input = { amount: '3000', currency: 'DZD' as const, rate: '', date: TODAY, note: 'CCP' };

  it('montant ≤ reste dû autorisé', () => {
    expect(validateRepayment(input, { today: TODAY, maxDa: 3000 })).toMatchObject({
      ok: true,
      values: { amountDa: 3000, note: 'CCP' },
    });
    const ko = validateRepayment(input, { today: TODAY, maxDa: 2999 });
    expect(!ko.ok && ko.errors.amount).toMatch(/dépasse le reste dû/);
  });

  it('EUR comparé en DA après conversion', () => {
    const eur = { ...input, amount: '12', currency: 'EUR' as const, rate: '250' };
    expect(validateRepayment(eur, { today: TODAY, maxDa: 3000 }).ok).toBe(true);
    expect(validateRepayment(eur, { today: TODAY, maxDa: 2999 }).ok).toBe(false);
  });

  it('date future refusée', () => {
    expect(
      validateRepayment({ ...input, date: '2026-10-22' }, { today: TODAY, maxDa: 5000 }),
    ).toEqual({ ok: false, errors: { date: 'La date ne peut pas être dans le futur.' } });
  });
});

describe('isDebtUnchanged / isRepaymentUnchanged', () => {
  const debt: Debt = {
    id: 'd',
    direction: 'owed_to_me',
    personId: 'p',
    amountDa: 10000,
    currency: 'DZD',
    originalAmountCents: null,
    eurRate: null,
    date: '2026-10-01',
    note: null,
    createdAt: '2026-10-01T10:00:00.000Z',
  };
  const result = validateDebt(debtInput(), { today: TODAY, repaidDa: 0 });
  if (!result.ok) throw new Error('attendu valide');

  it('même personne et mêmes valeurs → inchangée', () => {
    expect(isDebtUnchanged(debt, 'Karim', result.values)).toBe(true);
    expect(isDebtUnchanged(debt, 'Samia', result.values)).toBe(false);
    expect(isDebtUnchanged(debt, 'Karim', { ...result.values, amountDa: 1 })).toBe(false);
  });

  it('remboursement identique', () => {
    const repayment: DebtRepayment = { ...debt, debtId: 'd' };
    const { personName: _p, ...values } = result.values;
    expect(isRepaymentUnchanged(repayment, values)).toBe(true);
    expect(isRepaymentUnchanged(repayment, { ...values, note: 'x' })).toBe(false);
  });
});
