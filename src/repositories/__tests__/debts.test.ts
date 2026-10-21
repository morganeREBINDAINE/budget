import { asc } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { debtPeople, debtRepayments, debts, syncQueue } from '@/db/schema';
import type { DebtValues, RepaymentValues } from '@/lib/debts';
import {
  createDebt,
  createRepayment,
  debtRepaymentsQuery,
  debtsQuery,
  deleteDebt,
  deleteRepayment,
  peopleQuery,
  repaidByDebtQuery,
  updateDebt,
  updateRepayment,
} from '@/repositories/debts';
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

const tick = () => jest.advanceTimersByTime(1000);

const debtValues = (overrides: Partial<DebtValues> = {}): DebtValues => ({
  personName: 'Karim',
  amountDa: 10000,
  currency: 'DZD',
  originalAmountCents: null,
  eurRate: null,
  date: '2026-10-01',
  note: null,
  ...overrides,
});

const repaymentValues = (amountDa: number): RepaymentValues => ({
  amountDa,
  currency: 'DZD',
  originalAmountCents: null,
  eurRate: null,
  date: '2026-10-10',
  note: null,
});

const people = (userId = USER) =>
  peopleQuery(db, userId)
    .all()
    .map((p) => p.name);
const allPeople = () => db.select().from(debtPeople).orderBy(asc(debtPeople.createdAt)).all();
const queueTables = () =>
  db
    .select()
    .from(syncQueue)
    .orderBy(asc(syncQueue.createdAt))
    .all()
    .map((q) => q.tableName);

describe('createDebt', () => {
  it('crée la personne et la dette ensemble, avec leurs entrées sync_queue', () => {
    const debt = createDebt(db, USER, 'owed_to_me', debtValues());
    expect(people()).toEqual(['Karim']);
    expect(debtsQuery(db, USER, 'owed_to_me').all()).toEqual([
      expect.objectContaining({ id: debt.id, personId: allPeople()[0].id, amountDa: 10000 }),
    ]);
    expect(debtsQuery(db, USER, 'i_owe').all()).toEqual([]);
    expect(queueTables()).toEqual(['debt_people', 'debts']);
  });

  it('réutilise une personne existante (casse et accents ignorés)', () => {
    createDebt(db, USER, 'owed_to_me', debtValues({ personName: 'Amel' }));
    tick();
    createDebt(db, USER, 'i_owe', debtValues({ personName: 'AMÉL' }));
    expect(people()).toEqual(['Amel']);
  });

  it('les personnes sont propres à chaque compte', () => {
    createDebt(db, USER, 'owed_to_me', debtValues());
    createDebt(db, OTHER_USER, 'owed_to_me', debtValues());
    expect(people()).toEqual(['Karim']);
    expect(people(OTHER_USER)).toEqual(['Karim']);
  });
});

describe('updateDebt', () => {
  it('autre nom : rattachée à une nouvelle personne, l’ancienne supprimée si sans dette', () => {
    const debt = createDebt(db, USER, 'owed_to_me', debtValues());
    tick();
    updateDebt(db, USER, debt.id, debtValues({ personName: 'Samia', amountDa: 12000 }));
    expect(people()).toEqual(['Samia']);
    expect(debtsQuery(db, USER, 'owed_to_me').get()).toMatchObject({ amountDa: 12000 });
  });

  it('autre nom : l’ancienne personne est gardée si elle a d’autres dettes, sans être renommée', () => {
    const debt = createDebt(db, USER, 'owed_to_me', debtValues());
    tick();
    createDebt(db, USER, 'i_owe', debtValues());
    tick();
    updateDebt(db, USER, debt.id, debtValues({ personName: 'Samia' }));
    expect(people()).toEqual(['Karim', 'Samia']);
  });

  it('dette supprimée : RowNotFoundError', () => {
    const debt = createDebt(db, USER, 'owed_to_me', debtValues());
    deleteDebt(db, USER, debt.id);
    expect(() => updateDebt(db, USER, debt.id, debtValues())).toThrow(RowNotFoundError);
  });
});

describe('deleteDebt', () => {
  it('supprime la dette, ses remboursements et la personne sans autre dette', () => {
    const debt = createDebt(db, USER, 'owed_to_me', debtValues());
    tick();
    createRepayment(db, USER, debt.id, repaymentValues(2000));
    tick();
    createRepayment(db, USER, debt.id, repaymentValues(3000));
    tick();
    deleteDebt(db, USER, debt.id);

    expect(debtsQuery(db, USER, 'owed_to_me').all()).toEqual([]);
    expect(debtRepaymentsQuery(db, USER, debt.id).all()).toEqual([]);
    expect(people()).toEqual([]);
    // Suppression logique : les lignes restent (pour la synchro).
    expect(db.select().from(debts).all()).toHaveLength(1);
    expect(db.select().from(debtRepayments).all()).toHaveLength(2);
  });

  it('garde la personne si elle a une autre dette', () => {
    const debt = createDebt(db, USER, 'owed_to_me', debtValues());
    tick();
    createDebt(db, USER, 'i_owe', debtValues());
    tick();
    deleteDebt(db, USER, debt.id);
    expect(people()).toEqual(['Karim']);
  });

  it('personne sans dette : supprimée définitivement, un nom ressaisi crée une nouvelle personne', () => {
    const debt = createDebt(db, USER, 'owed_to_me', debtValues({ personName: 'Karim' }));
    const personId = debt.personId;
    tick();
    deleteDebt(db, USER, debt.id);
    expect(allPeople()).toEqual([]);
    expect(
      db
        .select()
        .from(syncQueue)
        .all()
        .filter((e) => e.tableName === 'debt_people' && e.op === 'delete')
        .map((e) => e.rowId),
    ).toEqual([personId]);
    tick();
    const again = createDebt(db, USER, 'owed_to_me', debtValues({ personName: 'karim' }));

    expect(again.personId).not.toBe(personId);
    expect(people()).toEqual(['karim']);
  });
});

describe('remboursements', () => {
  it('total remboursé par dette, modification et suppression', () => {
    const a = createDebt(db, USER, 'owed_to_me', debtValues());
    tick();
    const b = createDebt(db, USER, 'owed_to_me', debtValues({ personName: 'Samia' }));
    tick();
    const r1 = createRepayment(db, USER, a.id, repaymentValues(2000));
    tick();
    createRepayment(db, USER, a.id, repaymentValues(3000));
    tick();
    createRepayment(db, USER, b.id, repaymentValues(500));
    const other = createDebt(db, OTHER_USER, 'owed_to_me', debtValues());
    createRepayment(db, OTHER_USER, other.id, repaymentValues(9999));
    expect(() => createRepayment(db, OTHER_USER, a.id, repaymentValues(1))).toThrow(
      RowNotFoundError,
    );
    tick();

    const repaid = () =>
      new Map(
        repaidByDebtQuery(db, USER)
          .all()
          .map((r) => [r.debtId, r.repaidDa]),
      );
    expect(repaid()).toEqual(
      new Map([
        [a.id, 5000],
        [b.id, 500],
      ]),
    );

    updateRepayment(db, USER, r1.id, repaymentValues(1000));
    tick();
    expect(repaid().get(a.id)).toBe(4000);
    deleteRepayment(db, USER, r1.id);
    expect(repaid().get(a.id)).toBe(3000);
  });

  it('dette supprimée : RowNotFoundError à l’ajout', () => {
    const debt = createDebt(db, USER, 'owed_to_me', debtValues());
    deleteDebt(db, USER, debt.id);
    expect(() => createRepayment(db, USER, debt.id, repaymentValues(100))).toThrow(
      RowNotFoundError,
    );
  });
});
