import { getTableColumns } from 'drizzle-orm';

import { SYNCED_TABLES, syncedTables, type SyncedTableName } from '@/db/schema';
import type { SyncedRow } from '@/repositories/write';

// Correspondance des colonnes SQLite (clés camelCase des lignes Drizzle) ↔ Supabase (snake_case),
// déduite du schéma Drizzle : chaque colonne y porte sa clé et son nom SQL, identique côté Supabase
// (même modèle de données). Les types sont déjà compatibles (booléens, nombres, dates `YYYY-MM-DD`) ;
// seuls les horodatages sont normalisés.

/** Ligne telle qu'envoyée à / reçue de Supabase (snake_case). */
export type RemoteRow = Record<string, unknown>;

type ColumnPair = { local: string; remote: string; nullable: boolean };

// Horodatages (timestamptz côté Supabase) ; les colonnes `date` restent en `YYYY-MM-DD`.
const TIMESTAMP_COLUMNS = new Set(['createdAt', 'updatedAt', 'deletedAt']);

const columnsByTable = Object.fromEntries(
  SYNCED_TABLES.map((tableName) => [
    tableName,
    Object.entries(getTableColumns(syncedTables[tableName])).map(([key, column]): ColumnPair => ({
      local: key,
      remote: column.name,
      nullable: !column.notNull,
    })),
  ]),
) as Record<SyncedTableName, ColumnPair[]>;

const remoteNameByKey = Object.fromEntries(
  SYNCED_TABLES.map((tableName) => [
    tableName,
    new Map(columnsByTable[tableName].map(({ local, remote }) => [local, remote])),
  ]),
) as Record<SyncedTableName, Map<string, string>>;

/**
 * Horodatage → ISO 8601 du client (`…T…Z`, millisecondes), comparable en texte. Postgres renvoie
 * `+00:00` et des microsecondes, tronquées ici à la milliseconde.
 */
export function toIso(value: string): string {
  const time = Date.parse(value);
  if (Number.isNaN(time)) throw new Error('Horodatage invalide');
  return new Date(time).toISOString();
}

/** Liste des colonnes Supabase d'une table, pour `select()`. */
export function remoteSelect(tableName: SyncedTableName): string {
  return columnsByTable[tableName].map(({ remote }) => remote).join(', ');
}

/**
 * Ligne locale ou payload de `sync_queue` (camelCase) → ligne Supabase (snake_case) pour l'upsert.
 * Une clé inconnue est refusée ; une clé absente est tolérée (payload antérieur à une colonne).
 */
export function toRemote(tableName: SyncedTableName, row: Record<string, unknown>): RemoteRow {
  const names = remoteNameByKey[tableName];
  const remote: RemoteRow = {};
  for (const [key, value] of Object.entries(row)) {
    const name = names.get(key);
    if (name === undefined) throw new Error(`Colonne inconnue : ${tableName}.${key}`);
    remote[name] = value;
  }
  return remote;
}

/**
 * Ligne Supabase (snake_case) → ligne SQLite (camelCase), horodatages normalisés en ISO.
 * Une colonne manquante ou un horodatage invalide est refusé ; les colonnes en trop sont ignorées.
 */
export function toLocal<T extends SyncedTableName>(tableName: T, remote: RemoteRow): SyncedRow<T> {
  const row: Record<string, unknown> = {};
  for (const { local, remote: name, nullable } of columnsByTable[tableName]) {
    if (!(name in remote)) throw new Error(`Colonne manquante : ${tableName}.${name}`);
    const value = remote[name];
    if (TIMESTAMP_COLUMNS.has(local) && !(value === null && nullable)) {
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
        throw new Error(`Horodatage invalide : ${tableName}.${name}`);
      }
      row[local] = toIso(value);
    } else {
      row[local] = value;
    }
  }
  return row as SyncedRow<T>;
}
