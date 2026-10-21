import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import type { Database } from './client';
import migrations from './migrations/migrations';

// Migrations SQLite, appliquées au démarrage (DatabaseProvider) et par la tâche de fond, qui peut
// s'exécuter app fermée avant toute ouverture de l'interface (ex. après une mise à jour).
export const runMigrations = (db: Database) => migrate(db, migrations);
