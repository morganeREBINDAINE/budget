import { asc, eq } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { categories, syncQueue } from '@/db/schema';
import { categoriesQuery, categoryQuery, updateCategory } from '@/repositories/categories';
import { insertRow, RowNotFoundError, softDeleteRow } from '@/repositories/write';
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
  jest.useFakeTimers({ now: new Date('2026-10-20T10:00:00.000Z') });
});

afterEach(() => {
  jest.useRealTimers();
  close();
});

const addCategory = (userId: string, name: string, position: number) =>
  insertRow(db, 'categories', userId, { name, color: '#EF4444', icon: 'car', position });

const queue = () => db.select().from(syncQueue).orderBy(asc(syncQueue.createdAt)).all();

describe('categoriesQuery', () => {
  it('renvoie les catégories non supprimées du compte, triées par position', () => {
    addCategory(USER, 'Maison', 3);
    const voiture = addCategory(USER, 'Voiture', 1);
    const factures = addCategory(USER, 'Factures', 2);
    addCategory(OTHER_USER, 'Autre compte', 1);
    softDeleteRow(db, 'categories', USER, factures.id);

    expect(categoriesQuery(db, USER).all()).toEqual([
      { id: voiture.id, name: 'Voiture', color: '#EF4444', icon: 'car', position: 1 },
      expect.objectContaining({ name: 'Maison', position: 3 }),
    ]);
  });
});

describe('categoryQuery', () => {
  it('renvoie la catégorie du compte, rien si elle est supprimée ou d’un autre compte', () => {
    const voiture = addCategory(USER, 'Voiture', 1);
    const other = addCategory(OTHER_USER, 'Voiture', 1);

    expect(categoryQuery(db, USER, voiture.id).all()).toEqual([
      expect.objectContaining({ id: voiture.id, name: 'Voiture' }),
    ]);
    expect(categoryQuery(db, USER, other.id).all()).toEqual([]);

    softDeleteRow(db, 'categories', USER, voiture.id);
    expect(categoryQuery(db, USER, voiture.id).all()).toEqual([]);
  });
});

describe('updateCategory', () => {
  it('modifie nom, couleur et icône et ajoute la ligne complète à la file de synchro', () => {
    const voiture = addCategory(USER, 'Voiture', 1);
    jest.setSystemTime(new Date('2026-10-20T11:00:00.000Z'));

    const updated = updateCategory(db, USER, voiture.id, {
      name: 'Auto',
      color: '#3B82F6',
      icon: 'gas-station',
    });

    expect(updated).toEqual({
      id: voiture.id,
      name: 'Auto',
      color: '#3B82F6',
      icon: 'gas-station',
      position: 1,
    });
    const row = db.select().from(categories).where(eq(categories.id, voiture.id)).get();
    expect(row).toMatchObject({ name: 'Auto', updatedAt: '2026-10-20T11:00:00.000Z' });
    expect(queue().at(-1)).toMatchObject({
      userId: USER,
      tableName: 'categories',
      rowId: voiture.id,
      op: 'upsert',
      payload: row,
    });
  });

  it("refuse la catégorie d'un autre compte ou supprimée, sans rien écrire", () => {
    const other = addCategory(OTHER_USER, 'Voiture', 1);
    const deleted = addCategory(USER, 'Maison', 2);
    softDeleteRow(db, 'categories', USER, deleted.id);
    const before = queue().length;
    const patch = { name: 'Auto', color: '#3B82F6', icon: 'car' };

    expect(() => updateCategory(db, USER, other.id, patch)).toThrow(RowNotFoundError);
    expect(() => updateCategory(db, USER, deleted.id, patch)).toThrow(RowNotFoundError);
    expect(queue()).toHaveLength(before);
    expect(db.select().from(categories).where(eq(categories.id, other.id)).get()?.name).toBe(
      'Voiture',
    );
  });
});
