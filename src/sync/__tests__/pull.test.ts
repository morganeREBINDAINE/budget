import type { Database } from '@/db/client';
import { categories, debtPeople, SYNCED_TABLES, type SyncedTableName } from '@/db/schema';
import { getSetting, setSetting } from '@/repositories/settings';
import type { RemoteRow } from '@/sync/columns';
import { PAGE_SIZE, pullAll, type FetchPage, type FetchPageParams } from '@/sync/pull';
import { createTestDatabase } from '@/test/testDatabase';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const USER = 'user-a';
const OTHER_USER = 'user-b';

// Horodatages au format Postgres (microsecondes, `+00:00`).
const ts = (minute: number, micro = '000000') =>
  `2026-10-20T10:${String(minute).padStart(2, '0')}:00.${micro}+00:00`;

const person = (id: string, updatedAt: string, userId = USER): RemoteRow => ({
  id,
  user_id: userId,
  name: `Personne ${id}`,
  created_at: updatedAt,
  updated_at: updatedAt,
});

const category = (id: string, updatedAt: string): RemoteRow => ({
  id,
  user_id: USER,
  name: `Catégorie ${id}`,
  color: '#EF4444',
  icon: 'car',
  position: Number(id.replace(/\D/g, '')) || 1,
  created_at: updatedAt,
  updated_at: updatedAt,
  deleted_at: null,
});

/** Faux Supabase : applique repère, curseur, tri `(updated_at, id)` et limite sur des tables en mémoire. */
function fakeServer(tables: Partial<Record<SyncedTableName, RemoteRow[]>>) {
  const calls: FetchPageParams[] = [];
  const time = (row: RemoteRow) => Date.parse(row.updated_at as string);
  const fetchPage: FetchPage = async (params) => {
    calls.push(params);
    const { tableName, userId, since, after, limit } = params;
    return (tables[tableName] ?? [])
      .filter((row) => row.user_id === userId)
      .filter((row) => (since === null ? true : time(row) >= Date.parse(since)))
      .filter((row) => {
        if (!after) return true;
        const t = time(row);
        const a = Date.parse(after.updatedAt);
        return t > a || (t === a && (row.id as string) > after.id);
      })
      .sort((x, y) => time(x) - time(y) || (x.id as string).localeCompare(y.id as string))
      .slice(0, limit);
  };
  return { fetchPage, calls };
}

let db: Database;
let close: () => void;

beforeEach(() => {
  ({ db, close } = createTestDatabase());
});

afterEach(() => close());

describe('pullAll', () => {
  it('récupère toutes les tables au premier pull et enregistre le plus grand updated_at reçu', async () => {
    const server = fakeServer({
      categories: [category('cat-1', ts(1)), category('cat-2', ts(5, '123456'))],
      debt_people: [person('p-1', ts(3))],
    });
    await pullAll(db, USER, server.fetchPage);

    expect(server.calls.map((c) => c.tableName)).toEqual([...SYNCED_TABLES]);
    expect(server.calls.every((c) => c.since === null && c.after === null)).toBe(true);
    expect(db.select().from(categories).all()).toHaveLength(2);
    expect(db.select().from(debtPeople).all()).toHaveLength(1);
    // Repère conservé au format Postgres (microsecondes comprises).
    expect(getSetting(db, USER, 'last_pulled_at')).toBe(ts(5, '123456'));
  });

  it('pagine par curseur, y compris avec des updated_at identiques à la frontière', async () => {
    // Toutes les lignes ont le même updated_at : seul l'id départage.
    const rows = Array.from({ length: PAGE_SIZE * 2 + 5 }, (_, i) =>
      person(`p-${String(i).padStart(5, '0')}`, ts(2)),
    );
    const server = fakeServer({ debt_people: rows });
    await pullAll(db, USER, server.fetchPage);

    const peopleCalls = server.calls.filter((c) => c.tableName === 'debt_people');
    expect(peopleCalls).toHaveLength(3);
    expect(peopleCalls[1].after).toEqual({ updatedAt: ts(2), id: 'p-00999' });
    expect(db.select().from(debtPeople).all()).toHaveLength(rows.length);
  });

  it('ne récupère que les lignes modifiées depuis le dernier pull', async () => {
    setSetting(db, USER, 'last_pulled_at', ts(10));
    const server = fakeServer({
      debt_people: [person('p-old', ts(9)), person('p-edge', ts(10)), person('p-new', ts(12))],
    });
    await pullAll(db, USER, server.fetchPage);

    expect(server.calls.every((c) => c.since === ts(10))).toBe(true);
    expect(
      db
        .select()
        .from(debtPeople)
        .all()
        .map((p) => p.id)
        .sort(),
    ).toEqual(['p-edge', 'p-new']);
    expect(getSetting(db, USER, 'last_pulled_at')).toBe(ts(12));
  });

  it('garde le repère quand rien n’a changé', async () => {
    setSetting(db, USER, 'last_pulled_at', ts(10));
    await pullAll(db, USER, fakeServer({}).fetchPage);
    expect(getSetting(db, USER, 'last_pulled_at')).toBe(ts(10));
  });

  it('n’avance pas le repère si une table échoue (les tables déjà reçues restent enregistrées)', async () => {
    setSetting(db, USER, 'last_pulled_at', ts(1));
    const server = fakeServer({ categories: [category('cat-1', ts(5))] });
    const failing: FetchPage = async (params) => {
      if (params.tableName === 'debts') throw new Error('Réseau coupé');
      return server.fetchPage(params);
    };
    await expect(pullAll(db, USER, failing)).rejects.toThrow('Réseau coupé');
    expect(getSetting(db, USER, 'last_pulled_at')).toBe(ts(1));
    expect(db.select().from(categories).all()).toHaveLength(1);
  });

  it('coupure entre deux pages d’une table : repère gardé, tout récupéré au pull suivant sans doublon', async () => {
    const rows = Array.from({ length: PAGE_SIZE + 5 }, (_, i) =>
      person(`p-${String(i).padStart(5, '0')}`, ts(2)),
    );
    const server = fakeServer({ debt_people: rows });
    let cut = true;
    const interrupted: FetchPage = async (params) => {
      if (cut && params.tableName === 'debt_people' && params.after) {
        cut = false;
        throw new Error('Réseau coupé');
      }
      return server.fetchPage(params);
    };
    await expect(pullAll(db, USER, interrupted)).rejects.toThrow('Réseau coupé');
    // La première page est enregistrée, le repère n'a pas bougé.
    expect(db.select().from(debtPeople).all()).toHaveLength(PAGE_SIZE);
    expect(getSetting(db, USER, 'last_pulled_at')).toBeNull();

    await pullAll(db, USER, interrupted);
    expect(db.select().from(debtPeople).all()).toHaveLength(rows.length);
    expect(getSetting(db, USER, 'last_pulled_at')).not.toBeNull();
  });

  it('refuse une ligne invalide sans l’enregistrer', async () => {
    const { name: _name, ...incomplete } = person('p-1', ts(1));
    await expect(
      pullAll(db, USER, fakeServer({ debt_people: [incomplete] }).fetchPage),
    ).rejects.toThrow('Colonne manquante : debt_people.name');
    expect(db.select().from(debtPeople).all()).toHaveLength(0);
    expect(getSetting(db, USER, 'last_pulled_at')).toBeNull();
  });

  it('sépare les repères et les données de chaque compte', async () => {
    const server = fakeServer({
      debt_people: [person('p-a', ts(3)), person('p-b', ts(7), OTHER_USER)],
    });
    await pullAll(db, USER, server.fetchPage);
    expect(getSetting(db, USER, 'last_pulled_at')).toBe(ts(3));
    expect(getSetting(db, OTHER_USER, 'last_pulled_at')).toBeNull();
    expect(
      db
        .select()
        .from(debtPeople)
        .all()
        .map((p) => p.id),
    ).toEqual(['p-a']);
  });
});
