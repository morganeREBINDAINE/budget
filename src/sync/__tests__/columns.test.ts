import { SYNCED_TABLES, type SyncedTableName } from '@/db/schema';
import type { SyncedRow } from '@/repositories/write';
import { remoteSelect, toIso, toLocal, toRemote } from '@/sync/columns';

const USER = '0b6f1c1e-6a8f-4d55-9f3e-1d2c3b4a5f60';
const AT = '2026-10-20T10:00:00.123Z';

const base = { id: 'row-1', userId: USER, createdAt: AT, updatedAt: AT };

// Une ligne locale complète par table synchronisée.
const samples: { [T in SyncedTableName]: SyncedRow<T> } = {
  categories: {
    ...base,
    name: 'Voiture',
    color: '#E53935',
    icon: 'car',
    position: 1,
    deletedAt: null,
  },
  transactions: {
    ...base,
    type: 'expense',
    amountDa: 25000,
    currency: 'EUR',
    originalAmountCents: 10050,
    eurRate: 248.75,
    categoryId: 'cat-1',
    note: 'Essence',
    date: '2026-10-19',
    deletedAt: '2026-10-20T11:00:00.000Z',
  },
  recurring_payments: {
    ...base,
    name: 'Loyer',
    amountDa: 40000,
    categoryId: 'cat-1',
    frequency: 'yearly',
    dayOfMonth: 29,
    month: 2,
    startDate: '2026-01-01',
    active: false,
    note: null,
    deletedAt: null,
  },
  recurring_occurrences: {
    ...base,
    recurringPaymentId: 'rp-1',
    dueDate: '2026-10-05',
    paidAt: '2026-10-06',
    transactionId: 'tx-1',
  },
  debt_people: { ...base, name: 'Karim' },
  debts: {
    ...base,
    direction: 'owed_to_me',
    personId: 'person-1',
    amountDa: 5000,
    currency: 'DZD',
    originalAmountCents: null,
    eurRate: null,
    date: '2026-10-01',
    note: null,
    deletedAt: null,
  },
  debt_repayments: {
    ...base,
    debtId: 'debt-1',
    amountDa: 1000,
    currency: 'DZD',
    originalAmountCents: null,
    eurRate: null,
    date: '2026-10-10',
    note: null,
    deletedAt: null,
  },
};

describe('toRemote / toLocal', () => {
  it.each(SYNCED_TABLES)('aller-retour identique pour %s', (tableName) => {
    const row = samples[tableName];
    expect(toLocal(tableName, toRemote(tableName, row))).toEqual(row);
  });

  it('convertit les clés en snake_case sans toucher aux valeurs', () => {
    expect(toRemote('transactions', samples.transactions)).toEqual({
      id: 'row-1',
      user_id: USER,
      type: 'expense',
      amount_da: 25000,
      currency: 'EUR',
      original_amount_cents: 10050,
      eur_rate: 248.75,
      category_id: 'cat-1',
      note: 'Essence',
      date: '2026-10-19',
      created_at: AT,
      updated_at: AT,
      deleted_at: '2026-10-20T11:00:00.000Z',
    });
  });

  it('conserve les booléens et les dates YYYY-MM-DD', () => {
    const remote = toRemote('recurring_payments', samples.recurring_payments);
    expect(remote.active).toBe(false);
    expect(remote.start_date).toBe('2026-01-01');
    expect(toRemote('recurring_occurrences', samples.recurring_occurrences).paid_at).toBe(
      '2026-10-06',
    );
  });
});

describe('toRemote', () => {
  it('tolère un payload partiel (colonne ajoutée après l’écriture)', () => {
    expect(toRemote('debt_people', { id: 'row-1', name: 'Karim' })).toEqual({
      id: 'row-1',
      name: 'Karim',
    });
  });

  it('refuse une clé inconnue', () => {
    expect(() => toRemote('categories', { ...samples.categories, colour: '#000000' })).toThrow(
      'Colonne inconnue : categories.colour',
    );
  });

  it('refuse une clé déjà en snake_case', () => {
    expect(() => toRemote('categories', { user_id: USER })).toThrow(
      'Colonne inconnue : categories.user_id',
    );
  });
});

describe('toLocal', () => {
  const remoteCategory = () => toRemote('categories', samples.categories);

  it('normalise les horodatages Postgres (+00:00, microsecondes) en ISO du client', () => {
    const row = toLocal('categories', {
      ...remoteCategory(),
      created_at: '2026-10-19T08:30:00.123456+00:00',
      updated_at: '2026-10-20T12:00:00+02:00',
      deleted_at: '2026-10-20T10:00:00.5+00:00',
    });
    expect(row.createdAt).toBe('2026-10-19T08:30:00.123Z');
    expect(row.updatedAt).toBe('2026-10-20T10:00:00.000Z');
    expect(row.deletedAt).toBe('2026-10-20T10:00:00.500Z');
  });

  it('conserve deleted_at à null', () => {
    expect(toLocal('categories', remoteCategory()).deletedAt).toBeNull();
  });

  it('ignore les colonnes en trop', () => {
    expect(toLocal('categories', { ...remoteCategory(), extra: 1 })).toEqual(samples.categories);
  });

  it('refuse une colonne manquante', () => {
    const { icon: _icon, ...remote } = remoteCategory();
    expect(() => toLocal('categories', remote)).toThrow('Colonne manquante : categories.icon');
  });

  it('refuse un horodatage invalide', () => {
    expect(() => toLocal('categories', { ...remoteCategory(), updated_at: 'hier' })).toThrow(
      'Horodatage invalide : categories.updated_at',
    );
    expect(() => toLocal('categories', { ...remoteCategory(), created_at: null })).toThrow(
      'Horodatage invalide : categories.created_at',
    );
  });
});

describe('remoteSelect', () => {
  it('liste les colonnes Supabase de la table', () => {
    expect(remoteSelect('categories')).toBe(
      'id, user_id, name, color, icon, position, created_at, updated_at, deleted_at',
    );
    expect(remoteSelect('recurring_occurrences')).toBe(
      'id, user_id, recurring_payment_id, due_date, paid_at, transaction_id, created_at, updated_at',
    );
  });
});

describe('toIso', () => {
  it('refuse une valeur non datée', () => {
    expect(() => toIso('pas une date')).toThrow('Horodatage invalide');
  });
});
