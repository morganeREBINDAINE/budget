import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';

import type { Database } from '@/db/client';
import * as schema from '@/db/schema';

/**
 * Base SQLite en mémoire pour les tests (better-sqlite3, même dialecte synchrone que expo-sqlite),
 * avec les vraies migrations Drizzle du projet.
 */
export function createTestDatabase(): { db: Database; close: () => void } {
  const sqlite = new BetterSqlite3(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '../db/migrations') });
  return { db: db as unknown as Database, close: () => sqlite.close() };
}
