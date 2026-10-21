import { and, eq, isNull } from 'drizzle-orm';

import type { Database } from '@/db/client';
import {
  categories,
  debtPeople,
  debtRepayments,
  debts,
  recurringOccurrences,
  recurringPayments,
  syncQueue,
  transactions,
} from '@/db/schema';
import { importBackup, MissingCategoriesError, readBackup } from '@/repositories/backup';
import { insertRow } from '@/repositories/write';
import { createTestDatabase } from '@/test/testDatabase';

jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));

const USER = 'user-a';
const SOURCE = 'user-b';

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

/** 9 catégories, une transaction de chaque type, un paiement payé, une dette remboursée. */
function seed(userId: string, label: string) {
  const cats = Array.from({ length: 9 }, (_, i) =>
    insertRow(db, 'categories', userId, {
      name: `${label} ${i + 1}`,
      color: '#EF4444',
      icon: 'car',
      position: i + 1,
    }),
  );
  const expense = insertRow(db, 'transactions', userId, {
    type: 'expense',
    amountDa: 2500,
    currency: 'DZD',
    categoryId: cats[2].id,
    note: label,
    date: '2026-10-05',
  });
  insertRow(db, 'transactions', userId, {
    type: 'income',
    amountDa: 90000,
    currency: 'EUR',
    originalAmountCents: 37500,
    eurRate: 240,
    categoryId: null,
    date: '2026-10-01',
  });
  const payment = insertRow(db, 'recurring_payments', userId, {
    name: `Loyer ${label}`,
    amountDa: 2500,
    categoryId: cats[2].id,
    frequency: 'monthly',
    dayOfMonth: 5,
    startDate: '2026-09-01',
    active: true,
  });
  insertRow(db, 'recurring_occurrences', userId, {
    recurringPaymentId: payment.id,
    dueDate: '2026-10-05',
    paidAt: '2026-10-05',
    transactionId: expense.id,
  });
  const person = insertRow(db, 'debt_people', userId, { name: 'Karim' });
  const debt = insertRow(db, 'debts', userId, {
    direction: 'owed_to_me',
    personId: person.id,
    amountDa: 10000,
    currency: 'DZD',
    date: '2026-10-02',
  });
  insertRow(db, 'debt_repayments', userId, {
    debtId: debt.id,
    amountDa: 4000,
    currency: 'DZD',
    date: '2026-10-03',
  });
  return { cats, expense, payment, person, debt };
}

const active = <T extends typeof transactions | typeof recurringPayments | typeof debts>(
  table: T,
  userId = USER,
) =>
  db
    .select()
    .from(table as typeof transactions)
    .where(and(eq(table.userId, userId), isNull(table.deletedAt)))
    .all();

describe('importBackup', () => {
  it('remplace toutes les données du compte par celles du fichier, avec de nouveaux ids', () => {
    const local = seed(USER, 'Local');
    jest.setSystemTime(new Date('2026-10-21T11:00:00.000Z'));
    const source = seed(SOURCE, 'Fichier');
    const backup = readBackup(db, SOURCE);
    jest.setSystemTime(new Date('2026-10-21T12:00:00.000Z'));

    importBackup(db, USER, backup);

    // Catégories : mêmes ids locaux, nom / couleur / icône du fichier par position.
    const cats = db.select().from(categories).where(eq(categories.userId, USER)).all();
    expect(cats.map((c) => c.id).sort()).toEqual(local.cats.map((c) => c.id).sort());
    expect(cats.find((c) => c.position === 3)?.name).toBe('Fichier 3');

    // Transactions : anciennes supprimées, celles du fichier recréées (nouveaux ids, catégorie
    // locale, date de création conservée).
    const txs = active(transactions);
    expect(txs).toHaveLength(2);
    const expense = txs.find((t) => t.type === 'expense');
    expect(expense).toMatchObject({
      note: 'Fichier',
      categoryId: local.cats[2].id,
      createdAt: source.expense.createdAt,
      updatedAt: '2026-10-21T12:00:00.000Z',
    });
    expect(expense?.id).not.toBe(source.expense.id);
    expect(
      db.select().from(transactions).where(eq(transactions.id, local.expense.id)).get()?.deletedAt,
    ).toBe('2026-10-21T12:00:00.000Z');

    // Paiement régulier et occurrence : références vers les nouvelles lignes.
    const [payment] = active(
      recurringPayments,
    ) as unknown as (typeof recurringPayments.$inferSelect)[];
    expect(payment).toMatchObject({ name: 'Loyer Fichier', categoryId: local.cats[2].id });
    const occurrence = db
      .select()
      .from(recurringOccurrences)
      .where(
        and(
          eq(recurringOccurrences.userId, USER),
          eq(recurringOccurrences.recurringPaymentId, payment.id),
        ),
      )
      .get();
    expect(occurrence?.transactionId).toBe(expense?.id);

    // Personnes : l'ancienne effacée, une nouvelle créée même avec le même nom.
    const people = db.select().from(debtPeople).where(eq(debtPeople.userId, USER)).all();
    expect(people).toHaveLength(1);
    expect(people[0].id).not.toBe(local.person.id);
    expect(people[0].id).not.toBe(source.person.id);
    const [debt] = active(debts) as unknown as (typeof debts.$inferSelect)[];
    expect(debt.personId).toBe(people[0].id);
    const repayments = db
      .select()
      .from(debtRepayments)
      .where(and(eq(debtRepayments.userId, USER), isNull(debtRepayments.deletedAt)))
      .all();
    expect(repayments).toEqual([expect.objectContaining({ debtId: debt.id, amountDa: 4000 })]);

    // Tout part dans la file : suppressions, catégories modifiées et nouvelles lignes.
    const entries = db.select().from(syncQueue).where(eq(syncQueue.userId, USER)).all();
    expect(entries.filter((e) => e.op === 'delete').map((e) => e.rowId)).toEqual([local.person.id]);
    // 5 suppressions logiques + 1 suppression définitive + 9 catégories + 7 lignes recréées.
    expect(entries.filter((e) => e.createdAt >= '2026-10-21T12:00:00.000Z')).toHaveLength(22);
  });

  it('ne touche pas aux données d’un autre compte', () => {
    seed(USER, 'Local');
    const source = seed(SOURCE, 'Fichier');
    const before = readBackup(db, SOURCE);

    importBackup(db, USER, readBackup(db, SOURCE));

    expect(readBackup(db, SOURCE)).toEqual(before);
    expect(active(transactions, SOURCE).map((t) => t.id)).toContain(source.expense.id);
  });

  it('catégories locales incomplètes : erreur, rien n’est modifié', () => {
    seed(SOURCE, 'Fichier');
    const person = insertRow(db, 'debt_people', USER, { name: 'Karim' });
    const queueBefore = db.select().from(syncQueue).where(eq(syncQueue.userId, USER)).all();

    expect(() => importBackup(db, USER, readBackup(db, SOURCE))).toThrow(MissingCategoriesError);

    expect(db.select().from(debtPeople).where(eq(debtPeople.id, person.id)).get()).toBeDefined();
    expect(db.select().from(syncQueue).where(eq(syncQueue.userId, USER)).all()).toEqual(
      queueBefore,
    );
  });
});
