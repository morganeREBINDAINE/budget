import { asc, eq } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { categories, recurringOccurrences, syncQueue } from '@/db/schema';
import { subscribeLocalWrites } from '@/repositories/localWrites';
import {
  insertRow,
  nextTimestamp,
  RowNotFoundError,
  softDeleteRow,
  updateRow,
  writeTransaction,
} from '@/repositories/write';
import { createTestDatabase } from '@/test/testDatabase';

jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));

const USER = 'user-a';
const OTHER_USER = 'user-b';

const category = { name: 'Voiture', color: '#E53935', icon: 'car', position: 1 };

let db: Database;
let close: () => void;

beforeEach(() => {
  ({ db, close } = createTestDatabase());
  jest.useFakeTimers({ now: new Date('2026-10-20T10:00:00.000Z') });
});

afterEach(() => {
  jest.useRealTimers();
  close();
});

const queue = () => db.select().from(syncQueue).orderBy(asc(syncQueue.createdAt)).all();

describe('insertRow', () => {
  it('écrit la ligne avec id, user_id et horodatages, et une entrée de file avec la ligne complète', () => {
    const row = insertRow(db, 'categories', USER, category);

    expect(row).toEqual({
      ...category,
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      userId: USER,
      createdAt: '2026-10-20T10:00:00.000Z',
      updatedAt: '2026-10-20T10:00:00.000Z',
      deletedAt: null,
    });
    expect(db.select().from(categories).all()).toEqual([row]);
    expect(queue()).toEqual([
      expect.objectContaining({
        userId: USER,
        tableName: 'categories',
        rowId: row.id,
        op: 'upsert',
        payload: row,
        attempts: 0,
        lastError: null,
      }),
    ]);
  });

  it('ne met pas deleted_at dans le payload d’une table sans suppression logique', () => {
    const row = insertRow(db, 'recurring_occurrences', USER, {
      recurringPaymentId: 'rp-1',
      dueDate: '2026-10-05',
      paidAt: '2026-10-06',
      transactionId: 'tx-1',
    });
    expect(row).not.toHaveProperty('deletedAt');
    expect(queue()[0].payload).toEqual(row);
  });

  it('n’écrit rien si la ligne viole une contrainte', () => {
    expect(() => insertRow(db, 'categories', USER, { ...category, position: 10 })).toThrow();
    expect(db.select().from(categories).all()).toHaveLength(0);
    expect(queue()).toHaveLength(0);
  });
});

describe('updateRow', () => {
  it('fusionne le patch, avance updated_at et ajoute une nouvelle entrée de file', () => {
    const created = insertRow(db, 'categories', USER, category);
    jest.setSystemTime(new Date('2026-10-20T11:00:00.000Z'));

    const updated = updateRow(db, 'categories', USER, created.id, { name: 'Auto' });

    expect(updated).toEqual({ ...created, name: 'Auto', updatedAt: '2026-10-20T11:00:00.000Z' });
    const entries = queue();
    expect(entries).toHaveLength(2);
    expect(entries[1].payload).toEqual(updated);
  });

  it('garde updated_at strictement croissant si l’horloge recule', () => {
    const created = insertRow(db, 'categories', USER, category);
    jest.setSystemTime(new Date('2026-10-19T10:00:00.000Z'));

    const updated = updateRow(db, 'categories', USER, created.id, { name: 'Auto' });

    expect(updated.updatedAt).toBe('2026-10-20T10:00:00.001Z');
  });

  it('refuse une ligne d’un autre compte', () => {
    const created = insertRow(db, 'categories', OTHER_USER, category);
    expect(() => updateRow(db, 'categories', USER, created.id, { name: 'Auto' })).toThrow(
      RowNotFoundError,
    );
    expect(db.select().from(categories).get()?.name).toBe('Voiture');
  });

  it('refuse une ligne supprimée', () => {
    const created = insertRow(db, 'categories', USER, category);
    softDeleteRow(db, 'categories', USER, created.id);
    expect(() => updateRow(db, 'categories', USER, created.id, { name: 'Auto' })).toThrow(
      RowNotFoundError,
    );
  });

  it('n’ajoute rien à la file si la mise à jour viole une contrainte', () => {
    const created = insertRow(db, 'categories', USER, category);
    expect(() => updateRow(db, 'categories', USER, created.id, { name: '  ' })).toThrow();
    expect(queue()).toHaveLength(1);
    expect(db.select().from(categories).get()).toEqual(created);
  });

  it('modifie une ligne sans suppression logique', () => {
    const created = insertRow(db, 'recurring_occurrences', USER, {
      recurringPaymentId: 'rp-1',
      dueDate: '2026-10-05',
      paidAt: '2026-10-06',
      transactionId: 'tx-1',
    });
    const updated = updateRow(db, 'recurring_occurrences', USER, created.id, {
      paidAt: '2026-10-07',
    });
    expect(updated.paidAt).toBe('2026-10-07');
  });
});

describe('softDeleteRow', () => {
  it('renseigne deleted_at = updated_at et ajoute la ligne supprimée à la file', () => {
    const created = insertRow(db, 'categories', USER, category);
    jest.setSystemTime(new Date('2026-10-20T12:00:00.000Z'));

    const deleted = softDeleteRow(db, 'categories', USER, created.id);

    expect(deleted.deletedAt).toBe('2026-10-20T12:00:00.000Z');
    expect(deleted.updatedAt).toBe('2026-10-20T12:00:00.000Z');
    expect(queue()[1].payload).toEqual(deleted);
  });

  it('refuse une ligne déjà supprimée', () => {
    const created = insertRow(db, 'categories', USER, category);
    softDeleteRow(db, 'categories', USER, created.id);
    expect(() => softDeleteRow(db, 'categories', USER, created.id)).toThrow(RowNotFoundError);
  });
});

describe('restore', () => {
  it('annule la suppression logique, avance updated_at et ajoute la ligne à la file', () => {
    const created = insertRow(db, 'categories', USER, category);
    jest.setSystemTime(new Date('2026-10-20T12:00:00.000Z'));
    softDeleteRow(db, 'categories', USER, created.id);
    jest.setSystemTime(new Date('2026-10-20T13:00:00.000Z'));

    const restored = writeTransaction(db, USER, (w) => w.restore('categories', created.id));

    expect(restored).toEqual({ ...created, updatedAt: '2026-10-20T13:00:00.000Z' });
    expect(queue()[2].payload).toEqual(restored);
  });

  it('refuse une ligne non supprimée ou d’un autre compte', () => {
    const created = insertRow(db, 'categories', USER, category);
    expect(() => writeTransaction(db, USER, (w) => w.restore('categories', created.id))).toThrow(
      RowNotFoundError,
    );
    softDeleteRow(db, 'categories', USER, created.id);
    expect(() =>
      writeTransaction(db, OTHER_USER, (w) => w.restore('categories', created.id)),
    ).toThrow(RowNotFoundError);
  });
});

describe('writeTransaction', () => {
  it('écrit plusieurs lignes de façon atomique', () => {
    const result = writeTransaction(db, USER, (w) => {
      const tx = w.insert('transactions', {
        type: 'expense',
        amountDa: 25000,
        currency: 'DZD',
        categoryId: 'cat-1',
        date: '2026-10-06',
      });
      w.insert('recurring_occurrences', {
        recurringPaymentId: 'rp-1',
        dueDate: '2026-10-05',
        paidAt: '2026-10-06',
        transactionId: tx.id,
      });
      return tx.id;
    });

    expect(typeof result).toBe('string');
    expect(queue().map((e) => e.tableName)).toEqual(['transactions', 'recurring_occurrences']);
  });

  it('annule toutes les écritures si l’une échoue', () => {
    expect(() =>
      writeTransaction(db, USER, (w) => {
        w.insert('categories', category);
        w.insert('categories', { ...category, name: 'Doublon' }); // même position : unique
      }),
    ).toThrow();
    expect(db.select().from(categories).all()).toHaveLength(0);
    expect(queue()).toHaveLength(0);
  });

  it('refuse un callback asynchrone et annule ses écritures', () => {
    let writer: Parameters<Parameters<typeof writeTransaction>[2]>[0] | undefined;
    expect(() =>
      writeTransaction(db, USER, async (w) => {
        writer = w;
        w.insert('categories', category);
      }),
    ).toThrow('synchrone');
    expect(db.select().from(categories).all()).toHaveLength(0);
    // Une écriture après la fin de la transaction est refusée.
    expect(() => writer?.insert('categories', category)).toThrow('hors transaction');
  });

  it('isole les lignes par compte', () => {
    insertRow(db, 'categories', USER, category);
    insertRow(db, 'categories', OTHER_USER, category);
    expect(db.select().from(categories).where(eq(categories.userId, USER)).all()).toHaveLength(1);
    expect(
      db.select().from(recurringOccurrences).where(eq(recurringOccurrences.userId, USER)).all(),
    ).toHaveLength(0);
  });
});

describe('signal d’écriture locale', () => {
  let written: string[];
  let unsubscribe: () => void;

  beforeEach(() => {
    written = [];
    unsubscribe = subscribeLocalWrites((userId) => written.push(userId));
  });

  afterEach(() => unsubscribe());

  it('prévient une fois par transaction validée, avec le compte', () => {
    insertRow(db, 'categories', USER, category);
    writeTransaction(db, OTHER_USER, (w) => {
      w.insert('categories', category);
      w.insert('categories', { ...category, position: 2 });
    });
    expect(written).toEqual([USER, OTHER_USER]);
  });

  it('ne prévient pas si la transaction est annulée', () => {
    expect(() =>
      writeTransaction(db, USER, (w) => {
        w.insert('categories', category);
        throw new Error('annulée');
      }),
    ).toThrow('annulée');
    expect(written).toEqual([]);
  });

  it('ne prévient pas sans entrée ajoutée à la file', () => {
    writeTransaction(db, USER, () => undefined);
    expect(written).toEqual([]);
  });

  it('une erreur d’abonné ne fait pas échouer l’écriture', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const stop = subscribeLocalWrites(() => {
      throw new Error('abonné');
    });
    expect(() => insertRow(db, 'categories', USER, category)).not.toThrow();
    stop();
    jest.restoreAllMocks();
    expect(written).toEqual([USER]);
  });
});

describe('nextTimestamp', () => {
  it('utilise l’heure courante sans version précédente', () => {
    expect(nextTimestamp()).toBe('2026-10-20T10:00:00.000Z');
  });

  it('dépasse d’1 ms une version précédente plus récente', () => {
    expect(nextTimestamp('2026-10-21T00:00:00.000Z')).toBe('2026-10-21T00:00:00.001Z');
  });
});
