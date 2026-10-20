import { asc } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { syncQueue, type SyncedTableName } from '@/db/schema';
import { insertRow, updateRow } from '@/repositories/write';
import type { RemoteRow } from '@/sync/columns';
import { PUSH_BATCH_SIZE, pushAll, type UpsertRows } from '@/sync/push';
import { createTestDatabase } from '@/test/testDatabase';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));

const USER = 'user-a';
const OTHER_USER = 'user-b';

type Call = { tableName: SyncedTableName; rows: RemoteRow[] };

/** Faux Supabase : enregistre chaque upsert ; `failOn` fait échouer une table. */
function fakeUpsert(failOn?: SyncedTableName) {
  const calls: Call[] = [];
  const upsert: UpsertRows = async (tableName, rows) => {
    if (tableName === failOn) throw new Error(`Envoi impossible (${tableName}, 503)`);
    calls.push({ tableName, rows });
  };
  return { upsert, calls };
}

const addPerson = (name: string, userId = USER) =>
  insertRow(db, 'debt_people', userId, { name }).id;

const addCategory = (position: number) =>
  insertRow(db, 'categories', USER, {
    name: `Catégorie ${position}`,
    color: '#EF4444',
    icon: 'car',
    position,
  }).id;

const queue = () => db.select().from(syncQueue).orderBy(asc(syncQueue.createdAt)).all();

let db: Database;
let close: () => void;

beforeEach(() => {
  ({ db, close } = createTestDatabase());
});

afterEach(() => close());

describe('pushAll', () => {
  it('envoie la file en snake_case puis la vide', async () => {
    const id = addPerson('Karim');
    const { upsert, calls } = fakeUpsert();
    await pushAll(db, USER, upsert);

    expect(calls).toHaveLength(1);
    expect(calls[0].tableName).toBe('debt_people');
    expect(calls[0].rows).toEqual([
      expect.objectContaining({ id, user_id: USER, name: 'Karim', deleted_at: null }),
    ]);
    expect(queue()).toHaveLength(0);
  });

  it('ne fait aucun appel si la file est vide', async () => {
    const { upsert, calls } = fakeUpsert();
    const progress = jest.fn();
    await pushAll(db, USER, upsert, progress);
    expect(calls).toHaveLength(0);
    expect(progress).toHaveBeenCalledWith(0, 0);
  });

  it('respecte l’ordre d’écriture et regroupe par table dans un lot', async () => {
    addPerson('A');
    addCategory(1);
    addPerson('B');
    const { upsert, calls } = fakeUpsert();
    await pushAll(db, USER, upsert);

    expect(calls.map((c) => c.tableName)).toEqual(['debt_people', 'categories']);
    expect(calls[0].rows.map((r) => r.name)).toEqual(['A', 'B']);
  });

  it('n’envoie que la dernière version d’une ligne écrite plusieurs fois', async () => {
    const id = addPerson('Karim');
    updateRow(db, 'debt_people', USER, id, { name: 'Karim B.' });
    updateRow(db, 'debt_people', USER, id, { name: 'Karim Benali' });
    const { upsert, calls } = fakeUpsert();
    await pushAll(db, USER, upsert);

    expect(calls).toHaveLength(1);
    expect(calls[0].rows).toEqual([expect.objectContaining({ id, name: 'Karim Benali' })]);
    expect(queue()).toHaveLength(0);
  });

  it('envoie par lots de 200 et signale l’avancement', async () => {
    const count = PUSH_BATCH_SIZE + 50;
    for (let i = 0; i < count; i += 1) addPerson(`Personne ${i}`);
    const { upsert, calls } = fakeUpsert();
    const progress = jest.fn();
    await pushAll(db, USER, upsert, progress);

    expect(calls.map((c) => c.rows.length)).toEqual([PUSH_BATCH_SIZE, 50]);
    expect(progress.mock.calls).toEqual([
      [0, count],
      [PUSH_BATCH_SIZE, count],
      [count, count],
    ]);
    expect(queue()).toHaveLength(0);
  });

  it('en cas d’échec : garde les entrées non envoyées, note l’échec et s’arrête', async () => {
    addPerson('A');
    addCategory(1);
    addPerson('B');
    const { upsert, calls } = fakeUpsert('categories');
    await expect(pushAll(db, USER, upsert)).rejects.toThrow('Envoi impossible (categories, 503)');

    // debt_people est parti (premier groupe), categories est resté en file avec l'échec noté.
    expect(calls.map((c) => c.tableName)).toEqual(['debt_people']);
    const remaining = queue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({
      tableName: 'categories',
      attempts: 1,
      lastError: 'Envoi impossible (categories, 503)',
    });
  });

  it('relance sans doublon après un échec', async () => {
    addCategory(1);
    await expect(pushAll(db, USER, fakeUpsert('categories').upsert)).rejects.toThrow();
    const { upsert, calls } = fakeUpsert();
    await pushAll(db, USER, upsert);
    expect(calls).toHaveLength(1);
    expect(queue()).toHaveLength(0);
  });

  it('garde une écriture faite pendant l’envoi', async () => {
    addPerson('A');
    let written = false;
    const upsert: UpsertRows = async () => {
      if (!written) {
        written = true;
        addPerson('Écrite pendant l’envoi');
        // Le lot en cours est terminé : la nouvelle entrée part au lot suivant.
      }
    };
    await pushAll(db, USER, upsert);
    expect(written).toBe(true);
    expect(queue()).toHaveLength(0);
  });

  it('ne touche pas à la file d’un autre compte', async () => {
    addPerson('A');
    addPerson('B', OTHER_USER);
    const { upsert, calls } = fakeUpsert();
    await pushAll(db, USER, upsert);

    expect(calls.flatMap((c) => c.rows.map((r) => r.user_id))).toEqual([USER]);
    expect(queue()).toEqual([expect.objectContaining({ userId: OTHER_USER })]);
  });

  it('refuse un payload d’un autre compte sans l’envoyer', async () => {
    addPerson('A');
    // Entrée corrompue : payload d'un autre compte rangé dans la file de USER.
    db.update(syncQueue)
      .set({ payload: { id: 'x', userId: OTHER_USER, name: 'Intrus' } })
      .run();
    const { upsert, calls } = fakeUpsert();
    await expect(pushAll(db, USER, upsert)).rejects.toThrow('Entrée d’un autre compte');
    expect(calls).toHaveLength(0);
    expect(queue()[0]).toMatchObject({ attempts: 1 });
  });
});
