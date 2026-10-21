import { getTableColumns } from 'drizzle-orm';

import { SYNCED_TABLES, syncedTables, type SyncedTableName } from '@/db/schema';
import { MAX_AMOUNT_DA, MAX_AMOUNT_EUR_CENTS } from '@/lib/money';
import { normalizeName } from '@/lib/text';
import type { SyncedRow } from '@/repositories/write';
import { toIso, toRemote, type RemoteRow } from '@/sync/columns';

// Format de la sauvegarde JSON complète (docs/PLAN.md, phase 7) :
// `{ version, exported_at, categories[], transactions[], … }`.
// Colonnes en snake_case (mêmes noms que Supabase), lignes non supprimées uniquement, sans
// `user_id` ni `deleted_at` : aucun lien avec un compte, l'import recrée toutes les lignes avec de
// nouveaux ids dans le compte connecté (transfert possible d'un compte à l'autre). Le fichier est
// validé en entier avant tout import ; les messages d'erreur ne citent jamais de montant ni de note.

export const BACKUP_VERSION = 1;

// Colonnes jamais exportées : le compte est celui de l'import, les lignes supprimées sont exclues.
const EXCLUDED_COLUMNS = new Set(['userId', 'deletedAt']);

export type BackupRow<T extends SyncedTableName> = Omit<SyncedRow<T>, 'userId' | 'deletedAt'>;

export type BackupRows = { [T in SyncedTableName]: BackupRow<T>[] };

/** Contenu d'une sauvegarde, lignes en camelCase comme en local. */
export type Backup = {
  exportedAt: string;
  rows: BackupRows;
};

/** Fichier JSON tel qu'écrit sur le disque. */
export type BackupFile = {
  version: number;
  exported_at: string;
} & Record<SyncedTableName, RemoteRow[]>;

export type ParseBackupResult = { ok: true; backup: Backup } | { ok: false; error: string };

/** Sauvegarde → fichier JSON (snake_case). */
export function toBackupFile(backup: Backup): BackupFile {
  const file = {
    version: BACKUP_VERSION,
    exported_at: backup.exportedAt,
  } as BackupFile;
  for (const tableName of SYNCED_TABLES) {
    file[tableName] = (backup.rows[tableName] as Record<string, unknown>[]).map((row) => {
      const kept = Object.fromEntries(
        Object.entries(row).filter(([key]) => !EXCLUDED_COLUMNS.has(key)),
      );
      return toRemote(tableName, kept);
    });
  }
  return file;
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(toBackupFile(backup), null, 2);
}

// --- Validation -----------------------------------------------------------------------------

class InvalidBackupError extends Error {}

function fail(path: string, reason: string): never {
  throw new InvalidBackupError(`${path} : ${reason}`);
}

type ColumnKind = 'text' | 'integer' | 'real' | 'boolean';

type ColumnSpec = {
  key: string;
  name: string;
  kind: ColumnKind;
  nullable: boolean;
  enumValues?: readonly string[];
};

const KIND_BY_COLUMN_TYPE: Record<string, ColumnKind> = {
  SQLiteText: 'text',
  SQLiteInteger: 'integer',
  SQLiteReal: 'real',
  SQLiteBoolean: 'boolean',
};

// Colonnes exportées de chaque table, déduites du schéma Drizzle (comme `src/sync/columns.ts`).
const specsByTable = Object.fromEntries(
  SYNCED_TABLES.map((tableName) => [
    tableName,
    Object.entries(getTableColumns(syncedTables[tableName]))
      .filter(([key]) => !EXCLUDED_COLUMNS.has(key))
      .map(([key, column]): ColumnSpec => {
        const kind = KIND_BY_COLUMN_TYPE[column.columnType];
        if (!kind) throw new Error(`Type de colonne non géré : ${tableName}.${column.name}`);
        const enumValues = (column as { enumValues?: readonly string[] }).enumValues;
        return {
          key,
          name: column.name,
          kind,
          nullable: !column.notNull,
          enumValues: enumValues && enumValues.length > 0 ? enumValues : undefined,
        };
      }),
  ]),
) as Record<SyncedTableName, ColumnSpec[]>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const ID_COLUMNS = new Set([
  'id',
  'categoryId',
  'recurringPaymentId',
  'transactionId',
  'personId',
  'debtId',
]);
const DATE_COLUMNS = new Set(['date', 'dueDate', 'paidAt', 'startDate']);
const TIMESTAMP_COLUMNS = new Set(['createdAt', 'updatedAt']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isValidDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function parseTimestamp(path: string, value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    fail(path, 'horodatage invalide');
  }
  return toIso(value);
}

function parseValue(path: string, spec: ColumnSpec, value: unknown): unknown {
  if (value === null) {
    if (!spec.nullable) fail(path, 'valeur obligatoire');
    return null;
  }
  switch (spec.kind) {
    case 'boolean':
      if (typeof value !== 'boolean') fail(path, 'booléen attendu');
      return value;
    case 'integer':
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) fail(path, 'entier attendu');
      return value;
    case 'real':
      if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'nombre attendu');
      return value;
    case 'text':
      if (typeof value !== 'string') fail(path, 'texte attendu');
      if (spec.enumValues && !spec.enumValues.includes(value)) fail(path, 'valeur inconnue');
      if (ID_COLUMNS.has(spec.key) && !UUID.test(value)) fail(path, 'identifiant invalide');
      if (DATE_COLUMNS.has(spec.key) && !isValidDate(value)) fail(path, 'date invalide');
      if (TIMESTAMP_COLUMNS.has(spec.key)) return parseTimestamp(path, value);
      return value;
  }
}

/** Ligne du fichier (snake_case) → ligne locale (camelCase), colonnes typées. */
function parseRow(
  tableName: SyncedTableName,
  index: number,
  raw: unknown,
): Record<string, unknown> {
  const path = `${tableName}[${index}]`;
  if (!isPlainObject(raw)) fail(path, 'objet attendu');
  const specs = specsByTable[tableName];
  const known = new Set(specs.map((spec) => spec.name));
  for (const name of Object.keys(raw)) {
    if (!known.has(name)) fail(`${path}.${name}`, 'colonne inconnue');
  }
  const row: Record<string, unknown> = {};
  for (const spec of specs) {
    if (!(spec.name in raw)) fail(`${path}.${spec.name}`, 'colonne manquante');
    row[spec.key] = parseValue(`${path}.${spec.name}`, spec, raw[spec.name]);
  }
  return row;
}

type MoneyRow = {
  amountDa: number;
  currency: 'DZD' | 'EUR';
  originalAmountCents: number | null;
  eurRate: number | null;
};

// Mêmes règles que les CHECK SQLite / Supabase, bornes des colonnes `integer` Postgres comprises.
function checkMoney(path: string, row: MoneyRow): void {
  if (row.amountDa < 1 || row.amountDa > MAX_AMOUNT_DA) fail(`${path}.amount_da`, 'hors limites');
  if (row.currency === 'DZD') {
    if (row.originalAmountCents !== null || row.eurRate !== null) {
      fail(path, 'montant EUR renseigné pour une saisie en DA');
    }
  } else {
    const cents = row.originalAmountCents;
    if (cents === null || cents < 1 || cents > MAX_AMOUNT_EUR_CENTS) {
      fail(`${path}.original_amount_cents`, 'hors limites');
    }
    if (row.eurRate === null || row.eurRate <= 0) fail(`${path}.eur_rate`, 'taux invalide');
  }
}

const isBlank = (s: string) => s.trim() === '';

function uniqueIds(tableName: SyncedTableName, rows: { id: string }[]): Set<string> {
  const ids = new Set<string>();
  rows.forEach((row, i) => {
    if (ids.has(row.id)) fail(`${tableName}[${i}].id`, 'identifiant en double');
    ids.add(row.id);
  });
  return ids;
}

// Règles propres à chaque table et références entre tables (aucune clé étrangère SQL).
function checkRows(rows: BackupRows): void {
  const categoryIds = uniqueIds('categories', rows.categories);
  if (rows.categories.length !== 9) fail('categories', '9 catégories attendues');
  const positions = new Set<number>();
  rows.categories.forEach((c, i) => {
    const path = `categories[${i}]`;
    if (isBlank(c.name)) fail(`${path}.name`, 'nom vide');
    if (!HEX_COLOR.test(c.color)) fail(`${path}.color`, 'couleur invalide');
    if (isBlank(c.icon)) fail(`${path}.icon`, 'icône vide');
    if (c.position < 1 || c.position > 9) fail(`${path}.position`, 'position hors limites');
    if (positions.has(c.position)) fail(`${path}.position`, 'position en double');
    positions.add(c.position);
  });

  uniqueIds('transactions', rows.transactions);
  rows.transactions.forEach((t, i) => {
    const path = `transactions[${i}]`;
    checkMoney(path, t);
    if (t.type === 'income' && t.categoryId !== null) {
      fail(`${path}.category_id`, 'une entrée n’a pas de catégorie');
    }
    if (t.type === 'expense' && (t.categoryId === null || !categoryIds.has(t.categoryId))) {
      fail(`${path}.category_id`, 'catégorie introuvable');
    }
  });

  const paymentIds = uniqueIds('recurring_payments', rows.recurring_payments);
  rows.recurring_payments.forEach((p, i) => {
    const path = `recurring_payments[${i}]`;
    if (isBlank(p.name)) fail(`${path}.name`, 'nom vide');
    if (p.amountDa < 1 || p.amountDa > MAX_AMOUNT_DA) fail(`${path}.amount_da`, 'hors limites');
    if (!categoryIds.has(p.categoryId)) fail(`${path}.category_id`, 'catégorie introuvable');
    if (p.dayOfMonth < 1 || p.dayOfMonth > 31) fail(`${path}.day_of_month`, 'jour hors limites');
    if (p.frequency === 'monthly' && p.month !== null) {
      fail(`${path}.month`, 'pas de mois pour un paiement mensuel');
    }
    if (p.frequency === 'yearly' && (p.month === null || p.month < 1 || p.month > 12)) {
      fail(`${path}.month`, 'mois hors limites');
    }
  });

  // La dépense d'une occurrence peut avoir été supprimée depuis : sa référence n'est pas vérifiée.
  uniqueIds('recurring_occurrences', rows.recurring_occurrences);
  const dueKeys = new Set<string>();
  rows.recurring_occurrences.forEach((o, i) => {
    const path = `recurring_occurrences[${i}]`;
    if (!paymentIds.has(o.recurringPaymentId)) {
      fail(`${path}.recurring_payment_id`, 'paiement régulier introuvable');
    }
    const key = `${o.recurringPaymentId}|${o.dueDate}`;
    if (dueKeys.has(key)) fail(`${path}.due_date`, 'échéance en double');
    dueKeys.add(key);
  });

  const personIds = uniqueIds('debt_people', rows.debt_people);
  const names = new Set<string>();
  rows.debt_people.forEach((p, i) => {
    const path = `debt_people[${i}]`;
    if (isBlank(p.name)) fail(`${path}.name`, 'nom vide');
    const normalized = normalizeName(p.name);
    if (names.has(normalized)) fail(`${path}.name`, 'nom en double');
    names.add(normalized);
  });

  uniqueIds('debts', rows.debts);
  const debtAmounts = new Map<string, number>();
  rows.debts.forEach((d, i) => {
    const path = `debts[${i}]`;
    checkMoney(path, d);
    if (!personIds.has(d.personId)) fail(`${path}.person_id`, 'personne introuvable');
    debtAmounts.set(d.id, d.amountDa);
  });

  uniqueIds('debt_repayments', rows.debt_repayments);
  const repaid = new Map<string, number>();
  rows.debt_repayments.forEach((r, i) => {
    const path = `debt_repayments[${i}]`;
    checkMoney(path, r);
    const amount = debtAmounts.get(r.debtId);
    if (amount === undefined) fail(`${path}.debt_id`, 'dette introuvable');
    const total = (repaid.get(r.debtId) ?? 0) + r.amountDa;
    if (total > amount) fail(`${path}.amount_da`, 'remboursements supérieurs à la dette');
    repaid.set(r.debtId, total);
  });
}

const HEADER_KEYS = new Set(['version', 'exported_at']);

function parseFile(data: unknown): Backup {
  if (!isPlainObject(data)) fail('fichier', 'objet JSON attendu');
  for (const key of Object.keys(data)) {
    if (!HEADER_KEYS.has(key) && !(SYNCED_TABLES as readonly string[]).includes(key)) {
      fail(key, 'champ inconnu');
    }
  }
  const exportedAt = parseTimestamp('exported_at', data.exported_at);

  const rows = {} as Record<SyncedTableName, unknown[]>;
  for (const tableName of SYNCED_TABLES) {
    const list = data[tableName];
    if (!Array.isArray(list)) fail(tableName, 'liste attendue');
    rows[tableName] = list.map((raw, i) => parseRow(tableName, i, raw));
  }
  const backupRows = rows as unknown as BackupRows;
  checkRows(backupRows);

  return { exportedAt, rows: backupRows };
}

/**
 * Lit et valide un fichier de sauvegarde. Le fichier est refusé en entier à la première erreur,
 * avec un message lisible (chemin du champ et raison, jamais de valeur saisie).
 */
export function parseBackup(text: string): ParseBackupResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Fichier illisible : ce n’est pas une sauvegarde JSON.' };
  }
  if (!isPlainObject(data) || typeof data.version !== 'number') {
    return { ok: false, error: 'Ce fichier n’est pas une sauvegarde de l’application.' };
  }
  if (data.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: 'Cette sauvegarde vient d’une version plus récente de l’application.',
    };
  }
  if (data.version !== BACKUP_VERSION) {
    return { ok: false, error: 'Version de sauvegarde inconnue.' };
  }
  try {
    return { ok: true, backup: parseFile(data) };
  } catch (e) {
    if (e instanceof InvalidBackupError) {
      return { ok: false, error: `Sauvegarde invalide (${e.message}).` };
    }
    throw e;
  }
}

/** Contenu d'une sauvegarde affiché avant l'import. */
export type BackupSummary = {
  exportedAt: string;
  transactions: number;
  recurringPayments: number;
  debts: number;
};

export function summarizeBackup(backup: Backup): BackupSummary {
  return {
    exportedAt: backup.exportedAt,
    transactions: backup.rows.transactions.length,
    recurringPayments: backup.rows.recurring_payments.length,
    debts: backup.rows.debts.length,
  };
}
