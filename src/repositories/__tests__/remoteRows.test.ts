import { eq } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { categories, debtPeople, syncQueue, type CategoryRow } from '@/db/schema';
import { hasLocalCategories, saveRemoteRows } from '@/repositories/remoteRows';
import { getSetting, setSetting } from '@/repositories/settings';
import { updateRow } from '@/repositories/write';
import { createTestDatabase } from '@/test/testDatabase';

jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));

const USER = 'user-a';
const OTHER_USER = 'user-b';

const remoteCategory = (overrides: Partial<CategoryRow> = {}): CategoryRow => ({
  id: 'cat-1',
  userId: USER,
  name: 'Voiture',
  color: '#EF4444',
  icon: 'car',
  position: 1,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  deletedAt: null,
  ...overrides,
});

let db: Database;
let close: () => void;

beforeEach(() => {
  ({ db, close } = createTestDatabase());
});

afterEach(() => close());

const localCategory = (id = 'cat-1') =>
  db.select().from(categories).where(eq(categories.id, id)).get();

describe('saveRemoteRows', () => {
  it('insère les lignes absentes sans les mettre en file d’envoi', () => {
    saveRemoteRows(db, USER, 'categories', [
      remoteCategory(),
      remoteCategory({ id: 'cat-2', position: 2 }),
    ]);
    expect(localCategory()).toEqual(remoteCategory());
    expect(localCategory('cat-2')?.position).toBe(2);
    expect(db.select().from(syncQueue).all()).toHaveLength(0);
  });

  it('remplace une ligne par une version distante plus récente, sans changer created_at', () => {
    saveRemoteRows(db, USER, 'categories', [remoteCategory()]);
    const newer = remoteCategory({
      name: 'Auto',
      updatedAt: '2026-10-02T00:00:00.000Z',
      createdAt: '2020-01-01T00:00:00.000Z',
    });
    saveRemoteRows(db, USER, 'categories', [newer]);
    expect(localCategory()).toEqual({ ...newer, createdAt: '2026-10-01T00:00:00.000Z' });
  });

  it('ignore une version distante plus ancienne ou de même date', () => {
    saveRemoteRows(db, USER, 'categories', [
      remoteCategory({ name: 'Locale', updatedAt: '2026-10-05T00:00:00.000Z' }),
    ]);
    saveRemoteRows(db, USER, 'categories', [
      remoteCategory({ name: 'Ancienne', updatedAt: '2026-10-04T00:00:00.000Z' }),
    ]);
    saveRemoteRows(db, USER, 'categories', [
      remoteCategory({ name: 'Égale', updatedAt: '2026-10-05T00:00:00.000Z' }),
    ]);
    expect(localCategory()?.name).toBe('Locale');
  });

  it('ne remplace jamais une ligne modifiée en local et encore en file d’envoi', () => {
    saveRemoteRows(db, USER, 'categories', [remoteCategory()]);
    jest.useFakeTimers({ now: new Date('2026-10-03T00:00:00.000Z') });
    try {
      updateRow(db, 'categories', USER, 'cat-1', { name: 'Modifiée hors ligne' });
    } finally {
      jest.useRealTimers();
    }
    saveRemoteRows(db, USER, 'categories', [
      remoteCategory({ name: 'Distante', updatedAt: '2026-10-10T00:00:00.000Z' }),
    ]);
    expect(localCategory()?.name).toBe('Modifiée hors ligne');
  });

  it('applique une suppression logique distante', () => {
    saveRemoteRows(db, USER, 'categories', [remoteCategory()]);
    const deleted = remoteCategory({
      updatedAt: '2026-10-02T00:00:00.000Z',
      deletedAt: '2026-10-02T00:00:00.000Z',
    });
    saveRemoteRows(db, USER, 'categories', [deleted]);
    expect(localCategory()?.deletedAt).toBe('2026-10-02T00:00:00.000Z');
    expect(hasLocalCategories(db, USER)).toBe(false);
  });

  it('refuse les lignes d’un autre compte, sans rien écrire', () => {
    expect(() =>
      saveRemoteRows(db, USER, 'categories', [
        remoteCategory(),
        remoteCategory({ id: 'cat-2', userId: OTHER_USER }),
      ]),
    ).toThrow('Lignes d’un autre compte refusées (categories)');
    expect(localCategory()).toBeUndefined();
  });

  it('ne touche pas à la ligne d’un autre compte de même id', () => {
    saveRemoteRows(db, OTHER_USER, 'categories', [remoteCategory({ userId: OTHER_USER })]);
    saveRemoteRows(db, USER, 'categories', [
      remoteCategory({ name: 'Intrus', updatedAt: '2026-10-10T00:00:00.000Z' }),
    ]);
    expect(localCategory()).toEqual(remoteCategory({ userId: OTHER_USER }));
  });

  it('enregistre plusieurs lots (au-delà de 100 lignes) dans les autres tables', () => {
    const people = Array.from({ length: 250 }, (_, i) => ({
      id: `person-${i}`,
      userId: USER,
      name: `Personne ${i}`,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      deletedAt: null,
    }));
    saveRemoteRows(db, USER, 'debt_people', people);
    expect(db.select().from(debtPeople).all()).toHaveLength(250);
  });
});

describe('hasLocalCategories', () => {
  it('ne compte que les catégories non supprimées du compte', () => {
    expect(hasLocalCategories(db, USER)).toBe(false);
    saveRemoteRows(db, OTHER_USER, 'categories', [remoteCategory({ userId: OTHER_USER })]);
    expect(hasLocalCategories(db, USER)).toBe(false);
    saveRemoteRows(db, USER, 'categories', [remoteCategory({ id: 'cat-2' })]);
    expect(hasLocalCategories(db, USER)).toBe(true);
  });
});

describe('settings', () => {
  it('lit, crée et remplace un réglage propre au compte', () => {
    expect(getSetting(db, USER, 'last_pulled_at')).toBeNull();
    setSetting(db, USER, 'last_pulled_at', 'a');
    setSetting(db, USER, 'last_pulled_at', 'b');
    setSetting(db, OTHER_USER, 'last_pulled_at', 'c');
    expect(getSetting(db, USER, 'last_pulled_at')).toBe('b');
    expect(getSetting(db, OTHER_USER, 'last_pulled_at')).toBe('c');
  });
});
