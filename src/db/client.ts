import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'budget.db';

export type Database = ExpoSQLiteDatabase<typeof schema>;

let connection: { sqlite: SQLiteDatabase; db: Database } | null = null;

// Ouvre la base une seule fois (change listener actif pour les requêtes réactives useLiveQuery).
export function openDatabase(): { sqlite: SQLiteDatabase; db: Database } {
  if (!connection) {
    const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
    connection = { sqlite, db: drizzle(sqlite, { schema }) };
  }
  return connection;
}

// Après un échec d'ouverture ou de migration : la prochaine tentative rouvre la base.
export function resetDatabaseConnection() {
  try {
    connection?.sqlite.closeSync();
  } catch (e) {
    console.warn('[db] fermeture impossible', e);
  }
  connection = null;
}

let preparing: Promise<{ sqlite: SQLiteDatabase; db: Database }> | null = null;

// Ouvre la base puis applique les migrations. Une préparation en cours est partagée
// (démarrage, double effet en dev, « Réessayer ») ; en cas d'échec, la connexion est réinitialisée.
export function prepareDatabase(
  runMigrations: (db: Database) => Promise<void>,
): Promise<{ sqlite: SQLiteDatabase; db: Database }> {
  if (!preparing) {
    preparing = (async () => {
      try {
        const opened = openDatabase();
        await runMigrations(opened.db);
        return opened;
      } catch (e) {
        resetDatabaseConnection();
        throw e;
      }
    })().finally(() => {
      preparing = null;
    });
  }
  return preparing;
}
