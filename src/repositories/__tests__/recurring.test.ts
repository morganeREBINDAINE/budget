import { asc } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { recurringOccurrences, syncQueue, transactions } from '@/db/schema';
import type { RecurringValues } from '@/lib/recurring';
import {
  AlreadyPaidError,
  createRecurringPayment,
  deleteRecurringPayment,
  groupPaidDueDates,
  paidOccurrencesQuery,
  payDue,
  recurringPaymentQuery,
  recurringPaymentsQuery,
  updateRecurringPayment,
} from '@/repositories/recurring';
import { RowNotFoundError } from '@/repositories/write';
import { createTestDatabase } from '@/test/testDatabase';

jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));

const USER = 'user-a';
const OTHER_USER = 'user-b';

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

const values = (overrides: Partial<RecurringValues> = {}): RecurringValues => ({
  name: 'Loyer',
  amountDa: 25000,
  categoryId: 'cat-1',
  frequency: 'monthly',
  dayOfMonth: 5,
  month: null,
  startDate: '2026-10-01',
  active: true,
  note: null,
  ...overrides,
});

const queue = () => db.select().from(syncQueue).orderBy(asc(syncQueue.createdAt)).all();

describe('paiements réguliers', () => {
  it('création, lecture par compte, modification et suppression logique avec sync_queue', () => {
    const p = createRecurringPayment(db, USER, values());
    createRecurringPayment(db, OTHER_USER, values({ name: 'Autre' }));
    expect(p).toMatchObject({ name: 'Loyer', createdAt: '2026-10-21T10:00:00.000Z' });
    expect(
      recurringPaymentsQuery(db, USER)
        .all()
        .map((r) => r.name),
    ).toEqual(['Loyer']);

    jest.advanceTimersByTime(1000);
    updateRecurringPayment(db, USER, p.id, values({ dayOfMonth: 10 }));
    expect(recurringPaymentQuery(db, USER, p.id).all()[0].dayOfMonth).toBe(10);

    jest.advanceTimersByTime(1000);
    deleteRecurringPayment(db, USER, p.id);
    expect(recurringPaymentsQuery(db, USER).all()).toEqual([]);
    expect(() => updateRecurringPayment(db, USER, p.id, values())).toThrow(RowNotFoundError);

    const own = queue().filter((q) => q.userId === USER);
    expect(own.map((q) => q.tableName)).toEqual([
      'recurring_payments',
      'recurring_payments',
      'recurring_payments',
    ]);
  });
});

describe('payDue', () => {
  it('crée la dépense et l’occurrence ensemble, avec leurs entrées sync_queue', () => {
    const p = createRecurringPayment(db, USER, values());
    const expense = payDue(db, USER, { paymentId: p.id, dueDate: '2026-10-05' }, '2026-10-20');

    expect(expense).toMatchObject({
      type: 'expense',
      amountDa: 25000,
      currency: 'DZD',
      categoryId: 'cat-1',
      note: 'Loyer',
      date: '2026-10-20',
    });
    expect(db.select().from(recurringOccurrences).all()).toMatchObject([
      {
        userId: USER,
        recurringPaymentId: p.id,
        dueDate: '2026-10-05',
        paidAt: '2026-10-20',
        transactionId: expense.id,
      },
    ]);
    expect(queue().map((q) => q.tableName)).toEqual([
      'recurring_payments',
      'transactions',
      'recurring_occurrences',
    ]);
    expect(groupPaidDueDates(paidOccurrencesQuery(db, USER).all())).toEqual(
      new Map([[p.id, ['2026-10-05']]]),
    );
    expect(paidOccurrencesQuery(db, OTHER_USER).all()).toEqual([]);
  });

  it('période déjà payée (même avec un autre jour) : AlreadyPaidError, rien d’écrit', () => {
    const p = createRecurringPayment(db, USER, values());
    payDue(db, USER, { paymentId: p.id, dueDate: '2026-10-05' }, '2026-10-05');
    expect(() =>
      payDue(db, USER, { paymentId: p.id, dueDate: '2026-10-20' }, '2026-10-20'),
    ).toThrow(AlreadyPaidError);
    expect(db.select().from(transactions).all()).toHaveLength(1);
    expect(db.select().from(recurringOccurrences).all()).toHaveLength(1);
  });

  it('paiement supprimé ou d’un autre compte : RowNotFoundError', () => {
    const p = createRecurringPayment(db, USER, values());
    expect(() =>
      payDue(db, OTHER_USER, { paymentId: p.id, dueDate: '2026-10-05' }, '2026-10-05'),
    ).toThrow(RowNotFoundError);
    deleteRecurringPayment(db, USER, p.id);
    expect(() =>
      payDue(db, USER, { paymentId: p.id, dueDate: '2026-10-05' }, '2026-10-05'),
    ).toThrow(RowNotFoundError);
    expect(db.select().from(transactions).all()).toEqual([]);
  });

  it('modifier le paiement ne touche ni la dépense ni l’occurrence enregistrées', () => {
    const p = createRecurringPayment(db, USER, values());
    const expense = payDue(db, USER, { paymentId: p.id, dueDate: '2026-10-05' }, '2026-10-05');
    jest.advanceTimersByTime(1000);
    updateRecurringPayment(db, USER, p.id, values({ amountDa: 30000, dayOfMonth: 15 }));

    expect(db.select().from(transactions).all()).toMatchObject([
      { id: expense.id, amountDa: 25000, date: '2026-10-05' },
    ]);
    expect(db.select().from(recurringOccurrences).all()).toMatchObject([
      { dueDate: '2026-10-05', paidAt: '2026-10-05' },
    ]);
  });
});
