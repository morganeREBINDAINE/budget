import { asc, eq } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { syncQueue, transactions } from '@/db/schema';
import type { TransactionValues } from '@/lib/transactions';
import { getLastEurRate, saveLastEurRate } from '@/repositories/settings';
import {
  createTransaction,
  deleteTransaction,
  monthTransactionsQuery,
  transactionQuery,
  updateTransaction,
} from '@/repositories/transactions';
import { RowNotFoundError } from '@/repositories/write';
import { createTestDatabase } from '@/test/testDatabase';

jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));

const USER = 'user-a';
const OTHER_USER = 'user-b';
const OCTOBER = { year: 2026, month: 10 };

let db: Database;
let close: () => void;

beforeEach(() => {
  ({ db, close } = createTestDatabase());
  jest.useFakeTimers({ now: new Date('2026-10-21T10:00:00.000Z') });
});

afterEach(() => {
  jest.useRealTimers();
  close();
});

const values = (overrides: Partial<TransactionValues> = {}): TransactionValues => ({
  type: 'expense',
  amountDa: 1500,
  currency: 'DZD',
  originalAmountCents: null,
  eurRate: null,
  categoryId: 'cat-1',
  note: null,
  date: '2026-10-10',
  ...overrides,
});

const add = (date: string, overrides: Partial<TransactionValues> = {}, userId = USER) => {
  const t = createTransaction(db, userId, values({ date, ...overrides }));
  // Horodatages distincts : l'ordre de création est observable.
  jest.advanceTimersByTime(1000);
  return t;
};

const queue = () => db.select().from(syncQueue).orderBy(asc(syncQueue.createdAt)).all();

describe('monthTransactionsQuery', () => {
  it('ne renvoie que le mois demandé, du 1er au dernier jour inclus', () => {
    add('2026-09-30');
    const first = add('2026-10-01');
    const last = add('2026-10-31');
    add('2026-11-01');

    expect(
      monthTransactionsQuery(db, USER, OCTOBER)
        .all()
        .map((t) => t.id),
    ).toEqual([last.id, first.id]);
  });

  it('trie par date desc puis par création desc', () => {
    const older = add('2026-10-05');
    const sameDayFirst = add('2026-10-12');
    const sameDaySecond = add('2026-10-12');
    const newest = add('2026-10-20');

    expect(
      monthTransactionsQuery(db, USER, OCTOBER)
        .all()
        .map((t) => t.id),
    ).toEqual([newest.id, sameDaySecond.id, sameDayFirst.id, older.id]);
  });

  it('exclut les transactions supprimées et celles des autres comptes', () => {
    const kept = add('2026-10-10');
    const removed = add('2026-10-11');
    add('2026-10-12', {}, OTHER_USER);
    deleteTransaction(db, USER, removed.id);

    expect(monthTransactionsQuery(db, USER, OCTOBER).all()).toEqual([kept]);
  });

  it('décembre : le mois suivant est janvier de l’année suivante', () => {
    const december = add('2026-12-31');
    add('2027-01-01');
    expect(
      monthTransactionsQuery(db, USER, { year: 2026, month: 12 })
        .all()
        .map((t) => t.id),
    ).toEqual([december.id]);
  });
});

describe('transactionQuery', () => {
  it('renvoie la transaction du compte, rien si supprimée ou d’un autre compte', () => {
    const mine = add('2026-10-10');
    const other = add('2026-10-10', {}, OTHER_USER);

    expect(transactionQuery(db, USER, mine.id).all()).toEqual([mine]);
    expect(transactionQuery(db, USER, other.id).all()).toEqual([]);
    deleteTransaction(db, USER, mine.id);
    expect(transactionQuery(db, USER, mine.id).all()).toEqual([]);
  });
});

describe('écritures', () => {
  it('création : ligne rattachée au compte et entrée sync_queue dans la même transaction', () => {
    const created = createTransaction(
      db,
      USER,
      values({ currency: 'EUR', originalAmountCents: 1000, eurRate: 250, amountDa: 2500 }),
    );

    const row = db.select().from(transactions).where(eq(transactions.id, created.id)).get();
    expect(row).toMatchObject({
      userId: USER,
      amountDa: 2500,
      currency: 'EUR',
      originalAmountCents: 1000,
      eurRate: 250,
      deletedAt: null,
    });
    expect(queue()).toEqual([
      expect.objectContaining({ tableName: 'transactions', rowId: created.id, userId: USER }),
    ]);
  });

  it('création refusée par les contraintes : rien n’est écrit', () => {
    expect(() => createTransaction(db, USER, values({ categoryId: null }))).toThrow();
    expect(db.select().from(transactions).all()).toEqual([]);
    expect(queue()).toEqual([]);
  });

  it('modification : remplace les valeurs et ajoute une entrée sync_queue', () => {
    const created = add('2026-10-10');
    const updated = updateTransaction(
      db,
      USER,
      created.id,
      values({ amountDa: 2000, note: 'Courses', date: '2026-10-11' }),
    );

    expect(updated).toMatchObject({ id: created.id, amountDa: 2000, note: 'Courses' });
    expect(transactionQuery(db, USER, created.id).all()[0]).toMatchObject({
      amountDa: 2000,
      date: '2026-10-11',
    });
    expect(queue()).toHaveLength(2);
    expect(queue()[1].payload).toMatchObject({ amountDa: 2000, note: 'Courses' });
  });

  it('modification ou suppression d’une transaction supprimée ou d’un autre compte refusée', () => {
    const other = add('2026-10-10', {}, OTHER_USER);
    const removed = add('2026-10-10');
    deleteTransaction(db, USER, removed.id);

    expect(() => updateTransaction(db, USER, other.id, values())).toThrow(RowNotFoundError);
    expect(() => updateTransaction(db, USER, removed.id, values())).toThrow(RowNotFoundError);
    expect(() => deleteTransaction(db, USER, removed.id)).toThrow(RowNotFoundError);
  });

  it('suppression logique : deleted_at renseigné et entrée sync_queue', () => {
    const created = add('2026-10-10');
    deleteTransaction(db, USER, created.id);

    const row = db.select().from(transactions).where(eq(transactions.id, created.id)).get();
    expect(row?.deletedAt).not.toBeNull();
    expect(queue()).toHaveLength(2);
    expect(queue()[1].payload).toMatchObject({ id: created.id, deletedAt: row?.deletedAt });
  });
});

describe('dernier taux EUR', () => {
  it('null tant qu’aucun taux n’a été saisi, puis le dernier taux du compte', () => {
    expect(getLastEurRate(db, USER)).toBeNull();
    saveLastEurRate(db, USER, 250);
    saveLastEurRate(db, USER, 251.5);
    saveLastEurRate(db, OTHER_USER, 300);

    expect(getLastEurRate(db, USER)).toBe(251.5);
    expect(getLastEurRate(db, OTHER_USER)).toBe(300);
  });
});
