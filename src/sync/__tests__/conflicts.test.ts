import { eq } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { debtPeople, type SyncedTableName } from '@/db/schema';
import { insertRow, updateRow, writeTransaction } from '@/repositories/write';
import type { RemoteRow } from '@/sync/columns';
import { pullAll, type FetchPage } from '@/sync/pull';
import { pushAll, type DeleteRows, type UpsertRows } from '@/sync/push';
import type { SyncDeps } from '@/sync/syncNow';
import { createTestDatabase } from '@/test/testDatabase';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/network', () => ({ isOnline: jest.fn() }));
jest.mock('@/lib/errors', () => ({ reportError: jest.fn() }));
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));

// Conflits de bout en bout (docs/STORAGE.md §3) : vrai push, vrai pull et vraie base SQLite, face à
// un faux Supabase qui applique la règle du trigger `skip_stale_update` (une version qui n'est pas
// plus récente que celle en base est ignorée). La modification la plus récente gagne.

const USER = 'user-a';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 21, 10, minute));
const iso = (minute: number) => at(minute).toISOString();

/** Faux Supabase : tables en mémoire, upsert par id avec `skip_stale_update`, pull par repère. */
function fakeSupabase() {
  const tables = new Map<SyncedTableName, Map<string, RemoteRow>>();
  const table = (name: SyncedTableName) => {
    let rows = tables.get(name);
    if (!rows) {
      rows = new Map();
      tables.set(name, rows);
    }
    return rows;
  };
  const time = (row: RemoteRow) => Date.parse(row.updated_at as string);

  const upsert: UpsertRows = async (tableName, rows) => {
    const stored = table(tableName);
    for (const row of rows) {
      const current = stored.get(row.id as string);
      if (current && time(row) <= time(current)) continue;
      stored.set(row.id as string, row);
    }
  };

  const remove: DeleteRows = async (tableName, ids) => {
    for (const id of ids) table(tableName).delete(id);
  };

  const fetchPage: FetchPage = async ({ tableName, userId, since, after, limit }) =>
    [...table(tableName).values()]
      .filter((row) => row.user_id === userId)
      .filter((row) => since === null || time(row) >= Date.parse(since))
      .filter((row) => {
        if (!after) return true;
        const a = Date.parse(after.updatedAt);
        return time(row) > a || (time(row) === a && (row.id as string) > after.id);
      })
      .sort((x, y) => time(x) - time(y) || (x.id as string).localeCompare(y.id as string))
      .slice(0, limit);

  /** Modification faite ailleurs (autre appareil), directement en base. */
  const editRemote = (id: string, patch: Record<string, unknown>, minute: number) => {
    const row = table('debt_people').get(id);
    if (!row) throw new Error(`Ligne distante absente : ${id}`);
    table('debt_people').set(id, { ...row, ...patch, updated_at: iso(minute) });
  };

  const remoteName = (id: string) => table('debt_people').get(id)?.name;

  return { upsert, remove, fetchPage, editRemote, remoteName };
}

let store: typeof import('@/sync/syncNow');
let db: Database;
let close: () => void;
let server: ReturnType<typeof fakeSupabase>;
let deps: SyncDeps;

beforeEach(() => {
  jest.isolateModules(() => {
    store = jest.requireActual<typeof import('@/sync/syncNow')>('@/sync/syncNow');
  });
  ({ db, close } = createTestDatabase());
  server = fakeSupabase();
  deps = {
    isOnline: async () => true,
    push: (database, userId, onProgress) =>
      pushAll(database, userId, server.upsert, onProgress, server.remove),
    pull: (database, userId) => pullAll(database, userId, server.fetchPage),
    requestTimeouts: () => 0,
  };
  jest.useFakeTimers({ now: at(0) });
});

afterEach(() => {
  jest.useRealTimers();
  close();
});

const sync = async () => expect(store.syncNow(db, USER, {}, deps)).resolves.toEqual({ ok: true });

const localName = (id: string) =>
  db.select().from(debtPeople).where(eq(debtPeople.id, id)).get()?.name;

/** Crée une personne en local à la minute donnée et la synchronise. */
async function createSynced(name: string, minute: number) {
  jest.setSystemTime(at(minute));
  const { id } = insertRow(db, 'debt_people', USER, { name });
  await sync();
  return id;
}

describe('conflits', () => {
  it('version locale plus récente : le serveur la prend', async () => {
    const id = await createSynced('Initial', 1);
    server.editRemote(id, { name: 'Distant' }, 2);

    jest.setSystemTime(at(3));
    updateRow(db, 'debt_people', USER, id, { name: 'Local' });
    await sync();

    expect(server.remoteName(id)).toBe('Local');
    expect(localName(id)).toBe('Local');
  });

  it('version distante plus récente : la version locale est remplacée', async () => {
    const id = await createSynced('Initial', 1);
    server.editRemote(id, { name: 'Distant' }, 5);

    jest.setSystemTime(at(6));
    await sync();

    expect(localName(id)).toBe('Distant');
  });

  it('modifiée des deux côtés, la distante plus récente : elle gagne partout', async () => {
    const id = await createSynced('Initial', 1);
    jest.setSystemTime(at(2));
    updateRow(db, 'debt_people', USER, id, { name: 'Local' });
    server.editRemote(id, { name: 'Distant' }, 3);

    jest.setSystemTime(at(4));
    await sync();

    // Le push (plus ancien) est ignoré par le serveur, puis le pull ramène la version distante.
    expect(server.remoteName(id)).toBe('Distant');
    expect(localName(id)).toBe('Distant');
  });

  it('modification locale pendant le pull : conservée, puis envoyée à la synchro suivante', async () => {
    const id = await createSynced('Initial', 1);
    server.editRemote(id, { name: 'Distant' }, 2);

    jest.setSystemTime(at(3));
    const pull = deps.pull;
    let edited = false;
    deps.pull = async (database, userId) => {
      if (!edited) {
        edited = true;
        updateRow(db, 'debt_people', USER, id, { name: 'Pendant le pull' });
      }
      await pull(database, userId);
    };
    await sync();
    expect(localName(id)).toBe('Pendant le pull');

    jest.setSystemTime(at(4));
    await sync();
    expect(server.remoteName(id)).toBe('Pendant le pull');
    expect(localName(id)).toBe('Pendant le pull');
  });

  it('suppression définitive locale : effacée côté serveur, jamais réinsérée par le pull', async () => {
    const id = await createSynced('Initial', 1);
    jest.setSystemTime(at(2));
    writeTransaction(db, USER, (w) => w.hardDelete('debt_people', id));

    // Pull seul avant l'envoi : la ligne distante n'est pas réinsérée.
    await pullAll(db, USER, server.fetchPage);
    expect(localName(id)).toBeUndefined();

    jest.setSystemTime(at(3));
    await sync();
    expect(server.remoteName(id)).toBeUndefined();
    expect(localName(id)).toBeUndefined();
  });

  it('personne supprimée puis recréée avec le même nom : l’ancienne part avant la nouvelle', async () => {
    const old = await createSynced('Karim', 1);
    jest.setSystemTime(at(2));
    const recreated = writeTransaction(db, USER, (w) => {
      w.hardDelete('debt_people', old);
      return w.insert('debt_people', { name: 'Karim' }).id;
    });
    const order: string[] = [];
    const upsert: UpsertRows = async (tableName, rows) => {
      order.push('upsert');
      await server.upsert(tableName, rows);
    };
    const remove: DeleteRows = async (tableName, ids) => {
      order.push('delete');
      await server.remove(tableName, ids);
    };

    await pushAll(db, USER, upsert, undefined, remove);

    expect(order).toEqual(['delete', 'upsert']);
    expect(server.remoteName(old)).toBeUndefined();
    expect(server.remoteName(recreated)).toBe('Karim');
  });

  // Risque connu (docs/PLAN.md, Risques) : un pull lancé seul (pull initial à la reconnexion) avec
  // une modification locale en attente ignore la version distante plus récente de cette ligne, mais
  // avance le repère. Si une autre ligne a un updated_at encore plus récent, la version distante
  // n'est plus jamais récupérée : le téléphone garde sa version, plus ancienne. Quasi impossible
  // avec un seul téléphone (une version distante plus récente vient d'un autre appareil).
  it('cas limite connu : pull seul avec une ligne en attente plus ancienne que la version distante', async () => {
    const id = await createSynced('Initial', 1);
    const other = await createSynced('Autre', 1);
    jest.setSystemTime(at(2));
    updateRow(db, 'debt_people', USER, id, { name: 'Local' });
    server.editRemote(id, { name: 'Distant' }, 3);
    server.editRemote(other, { name: 'Autre distant' }, 4);

    jest.setSystemTime(at(5));
    await pullAll(db, USER, server.fetchPage);
    await sync();

    // Comportement actuel : le serveur garde « Distant », le téléphone « Local ».
    expect(server.remoteName(id)).toBe('Distant');
    expect(localName(id)).toBe('Local');
    expect(localName(other)).toBe('Autre distant');
  });
});
