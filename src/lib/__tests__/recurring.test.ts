import {
  dueDateIn,
  dueDatesOf,
  duePaymentsOf,
  firstPossibleDueDate,
  isRecurringUnchanged,
  nextDueDate,
  type RecurringInput,
  validateRecurring,
} from '@/lib/recurring';
import type { RecurringPayment } from '@/types/budget';

const payment = (overrides: Partial<RecurringPayment> = {}): RecurringPayment => ({
  id: 'rec-1',
  name: 'Loyer',
  amountDa: 25000,
  categoryId: 'cat-1',
  frequency: 'monthly',
  dayOfMonth: 5,
  month: null,
  startDate: '2026-01-01',
  active: true,
  note: null,
  // Midi UTC : même date locale quel que soit le fuseau des tests.
  createdAt: '2026-01-01T12:00:00.000Z',
  ...overrides,
});

describe('dueDateIn', () => {
  it('jour 31 → dernier jour des mois plus courts', () => {
    expect(dueDateIn(2026, 1, 31)).toBe('2026-01-31');
    expect(dueDateIn(2026, 4, 31)).toBe('2026-04-30');
    expect(dueDateIn(2026, 2, 31)).toBe('2026-02-28');
  });

  it('29 février : 28 hors année bissextile, 29 sinon', () => {
    expect(dueDateIn(2027, 2, 29)).toBe('2027-02-28');
    expect(dueDateIn(2028, 2, 29)).toBe('2028-02-29');
  });
});

describe('firstPossibleDueDate', () => {
  it('la plus tardive entre la date de début et la création', () => {
    expect(
      firstPossibleDueDate({ startDate: '2026-01-01', createdAt: '2026-03-10T12:00:00.000Z' }),
    ).toBe('2026-03-10');
    expect(
      firstPossibleDueDate({ startDate: '2026-06-01', createdAt: '2026-03-10T12:00:00.000Z' }),
    ).toBe('2026-06-01');
  });
});

describe('dueDatesOf', () => {
  it('mensuel : une échéance par mois jusqu’à aujourd’hui inclus', () => {
    expect(dueDatesOf(payment(), [], '2026-03-05')).toEqual([
      '2026-01-05',
      '2026-02-05',
      '2026-03-05',
    ]);
    expect(dueDatesOf(payment(), [], '2026-03-04')).toEqual(['2026-01-05', '2026-02-05']);
  });

  it('plusieurs retards : seules les échéances non payées restent', () => {
    expect(dueDatesOf(payment(), ['2026-02-05'], '2026-04-10')).toEqual([
      '2026-01-05',
      '2026-03-05',
      '2026-04-05',
    ]);
  });

  it('aucune échéance avant la création (pas d’arriéré)', () => {
    const p = payment({ startDate: '2025-01-01', createdAt: '2026-03-10T12:00:00.000Z' });
    expect(dueDatesOf(p, [], '2026-05-01')).toEqual(['2026-04-05']);
  });

  it('création le jour de l’échéance : due le jour même', () => {
    const p = payment({ startDate: '2026-03-05', createdAt: '2026-03-05T12:00:00.000Z' });
    expect(dueDatesOf(p, [], '2026-03-05')).toEqual(['2026-03-05']);
  });

  it('date de début future : rien', () => {
    expect(dueDatesOf(payment({ startDate: '2026-12-01' }), [], '2026-10-21')).toEqual([]);
  });

  it('inactif : rien', () => {
    expect(dueDatesOf(payment({ active: false }), [], '2026-10-21')).toEqual([]);
  });

  it('jour 31 sur des mois courts', () => {
    const p = payment({ dayOfMonth: 31 });
    expect(dueDatesOf(p, [], '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('annuel : une échéance par an, au mois choisi', () => {
    const p = payment({
      frequency: 'yearly',
      dayOfMonth: 15,
      month: 3,
      startDate: '2024-01-01',
      createdAt: '2024-01-01T12:00:00.000Z',
    });
    expect(dueDatesOf(p, [], '2026-03-14')).toEqual(['2024-03-15', '2025-03-15']);
    expect(dueDatesOf(p, ['2024-03-15'], '2026-03-15')).toEqual(['2025-03-15', '2026-03-15']);
  });

  it('annuel le 29 février', () => {
    const p = payment({
      frequency: 'yearly',
      dayOfMonth: 29,
      month: 2,
      startDate: '2027-01-01',
      createdAt: '2027-01-01T12:00:00.000Z',
    });
    expect(dueDatesOf(p, [], '2028-12-31')).toEqual(['2027-02-28', '2028-02-29']);
  });

  it('paiement déjà confirmé puis jour modifié : la période reste couverte', () => {
    // Payé le 5 mars, puis le jour passe au 20 : pas de nouvel encart pour mars.
    const p = payment({ dayOfMonth: 20 });
    expect(dueDatesOf(p, ['2026-01-05', '2026-02-05', '2026-03-05'], '2026-03-25')).toEqual([]);
  });

  it('annuel : mois modifié après paiement, l’année reste couverte', () => {
    const p = payment({
      frequency: 'yearly',
      dayOfMonth: 1,
      month: 9,
      startDate: '2026-01-01',
    });
    expect(dueDatesOf(p, ['2026-03-15'], '2026-10-21')).toEqual([]);
  });
});

describe('nextDueDate', () => {
  it('échéance en retard : la plus ancienne non payée', () => {
    expect(nextDueDate(payment(), ['2026-01-05'], '2026-03-10')).toBe('2026-02-05');
  });

  it('à jour : la prochaine à venir', () => {
    expect(nextDueDate(payment(), ['2026-01-05', '2026-02-05'], '2026-02-10')).toBe('2026-03-05');
  });

  it('période en cours déjà payée (jour modifié) : la suivante', () => {
    const p = payment({ dayOfMonth: 20 });
    expect(nextDueDate(p, ['2026-01-05', '2026-02-05', '2026-03-05'], '2026-03-10')).toBe(
      '2026-04-20',
    );
  });

  it('date de début future : première échéance après la date de début', () => {
    expect(nextDueDate(payment({ startDate: '2026-12-10' }), [], '2026-10-21')).toBe('2027-01-05');
  });

  it('inactif : null', () => {
    expect(nextDueDate(payment({ active: false }), [], '2026-10-21')).toBeNull();
  });
});

describe('duePaymentsOf', () => {
  it('tous les paiements, de la plus ancienne échéance à la plus récente', () => {
    const loyer = payment({ id: 'a', name: 'Loyer', dayOfMonth: 10 });
    const box = payment({ id: 'b', name: 'Box', dayOfMonth: 3 });
    const paid = new Map([['a', ['2026-01-10']]]);
    expect(
      duePaymentsOf([loyer, box], paid, '2026-02-15').map((d) => [d.payment.id, d.dueDate]),
    ).toEqual([
      ['b', '2026-01-03'],
      ['b', '2026-02-03'],
      ['a', '2026-02-10'],
    ]);
  });
});

describe('validateRecurring', () => {
  const input = (overrides: Partial<RecurringInput> = {}): RecurringInput => ({
    name: '  Loyer ',
    amount: '25000',
    categoryId: 'cat-1',
    frequency: 'monthly',
    dayOfMonth: 5,
    month: 3,
    startDate: '2026-10-21',
    active: true,
    note: '  ',
    ...overrides,
  });
  const categories = new Set(['cat-1']);

  it('valeurs nettoyées : nom sans espaces, mois null en mensuel, note vide → null', () => {
    expect(validateRecurring(input(), categories)).toEqual({
      ok: true,
      values: {
        name: 'Loyer',
        amountDa: 25000,
        categoryId: 'cat-1',
        frequency: 'monthly',
        dayOfMonth: 5,
        month: null,
        startDate: '2026-10-21',
        active: true,
        note: null,
      },
    });
  });

  it('annuel : mois conservé, requis', () => {
    const ok = validateRecurring(input({ frequency: 'yearly' }), categories);
    expect(ok.ok && ok.values.month).toBe(3);
    const ko = validateRecurring(input({ frequency: 'yearly', month: null }), categories);
    expect(ko).toEqual({ ok: false, errors: { month: 'Choisis un mois.' } });
  });

  it('erreurs : nom, montant, catégorie, jour', () => {
    const result = validateRecurring(
      input({ name: ' ', amount: '12,5', categoryId: 'inconnue', dayOfMonth: null }),
      categories,
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        name: 'Saisis un nom.',
        amount: 'Le montant en dinars doit être un nombre entier.',
        category: 'Choisis une catégorie.',
        day: 'Choisis un jour.',
      },
    });
  });

  it('nom de plus de 30 caractères, montant nul ou trop élevé', () => {
    expect(validateRecurring(input({ name: 'x'.repeat(31) }), categories)).toMatchObject({
      errors: { name: '30 caractères maximum.' },
    });
    expect(validateRecurring(input({ amount: '0' }), categories)).toMatchObject({
      errors: { amount: 'Saisis un montant supérieur à 0.' },
    });
    expect(validateRecurring(input({ amount: '1000000000' }), categories)).toMatchObject({
      errors: { amount: 'Montant trop élevé.' },
    });
  });

  it('isRecurringUnchanged', () => {
    const p = payment({ name: 'Loyer', startDate: '2026-10-21' });
    const result = validateRecurring(input(), categories);
    if (!result.ok) throw new Error('attendu valide');
    expect(isRecurringUnchanged(p, result.values)).toBe(true);
    expect(isRecurringUnchanged(p, { ...result.values, dayOfMonth: 6 })).toBe(false);
  });
});
