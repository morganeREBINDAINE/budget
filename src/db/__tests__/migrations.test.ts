import BetterSqlite3 from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// Migrations de données : chaque migration SQL est appliquée sur une base remplie avec l'état
// précédent du schéma.

const MIGRATIONS = path.join(__dirname, '../migrations');

function apply(sqlite: BetterSqlite3.Database, tag: string) {
  const content = fs.readFileSync(path.join(MIGRATIONS, `${tag}.sql`), 'utf8');
  for (const statement of content.split('--> statement-breakpoint')) {
    if (statement.trim()) sqlite.exec(statement);
  }
}

describe('0003_hard_delete_debt_people', () => {
  let sqlite: BetterSqlite3.Database;

  beforeEach(() => {
    sqlite = new BetterSqlite3(':memory:');
    apply(sqlite, '0000_init');
    apply(sqlite, '0001_scope_occurrence_unique_per_user');
    apply(sqlite, '0002_sync_queue_rejected_at');
  });

  afterEach(() => sqlite.close());

  const person = (id: string, name: string, deletedAt: string | null) => {
    sqlite
      .prepare(
        `INSERT INTO debt_people (id, user_id, name, created_at, updated_at, deleted_at)
         VALUES (?, 'u', ?, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', ?)`,
      )
      .run(id, name, deletedAt);
    sqlite
      .prepare(
        `INSERT INTO sync_queue (id, user_id, table_name, row_id, op, payload, created_at)
         VALUES (?, 'u', 'debt_people', ?, 'upsert', ?, '2026-10-01T00:00:00.000Z')`,
      )
      .run(`q-${id}`, id, JSON.stringify({ id, userId: 'u', name, deletedAt }));
  };

  it('efface les personnes supprimées et leurs entrées, retire deletedAt des payloads', () => {
    person('p-1', 'Karim', null);
    person('p-2', 'Samia', '2026-10-02T00:00:00.000Z');

    apply(sqlite, '0003_hard_delete_debt_people');

    expect(sqlite.prepare('SELECT * FROM debt_people').all()).toEqual([
      {
        id: 'p-1',
        user_id: 'u',
        name: 'Karim',
        created_at: '2026-10-01T00:00:00.000Z',
        updated_at: '2026-10-01T00:00:00.000Z',
      },
    ]);
    const entries = sqlite.prepare('SELECT row_id, payload FROM sync_queue').all() as {
      row_id: string;
      payload: string;
    }[];
    expect(entries.map((e) => [e.row_id, JSON.parse(e.payload)])).toEqual([
      ['p-1', { id: 'p-1', userId: 'u', name: 'Karim' }],
    ]);
  });

  it('un nom supprimé peut être recréé après la migration', () => {
    person('p-1', 'Karim', '2026-10-02T00:00:00.000Z');
    apply(sqlite, '0003_hard_delete_debt_people');

    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO debt_people (id, user_id, name, created_at, updated_at)
           VALUES ('p-2', 'u', 'karim', 'x', 'x')`,
        )
        .run(),
    ).not.toThrow();
  });
});
