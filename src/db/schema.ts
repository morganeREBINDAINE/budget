import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// Schéma local (source de vérité de l'UI, cf. docs/STORAGE.md et le modèle de données de docs/PLAN.md).
// Conventions : id UUID généré sur le client, user_id sur chaque ligne, dates `YYYY-MM-DD`,
// horodatages ISO 8601 gérés par le client, montants en entiers (DA ou centimes),
// suppression logique via deleted_at. Les CHECK testent NULL explicitement (NULL y vaut « vrai »). Pas de clés étrangères SQL : la synchro (pull) et l'import
// peuvent insérer les lignes dans n'importe quel ordre ; la cohérence est vérifiée par les repositories.

const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
};

const softDelete = { deletedAt: text('deleted_at') };

// Montant DA final + saisie EUR d'origine (transactions, dettes, remboursements).
const money = {
  amountDa: integer('amount_da').notNull(),
  currency: text('currency', { enum: ['DZD', 'EUR'] }).notNull(),
  originalAmountCents: integer('original_amount_cents'),
  eurRate: real('eur_rate'),
};

const moneyChecks = (
  name: string,
  t: { amountDa: unknown; currency: unknown; originalAmountCents: unknown; eurRate: unknown },
) => [
  check(`${name}_amount_positive`, sql`${t.amountDa} > 0`),
  check(
    `${name}_eur_fields`,
    sql`(${t.currency} = 'DZD' AND ${t.originalAmountCents} IS NULL AND ${t.eurRate} IS NULL)
      OR (${t.currency} = 'EUR' AND ${t.originalAmountCents} IS NOT NULL AND ${t.originalAmountCents} > 0
        AND ${t.eurRate} IS NOT NULL AND ${t.eurRate} > 0)`,
  ),
];

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull(),
    icon: text('icon').notNull(),
    position: integer('position').notNull(),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex('categories_user_position_unique').on(t.userId, t.position),
    index('categories_user_updated_idx').on(t.userId, t.updatedAt),
    check('categories_position_range', sql`${t.position} BETWEEN 1 AND 9`),
    check('categories_name_not_empty', sql`length(trim(${t.name})) > 0`),
  ],
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    type: text('type', { enum: ['income', 'expense'] }).notNull(),
    ...money,
    // Requis si expense, null si income.
    categoryId: text('category_id'),
    note: text('note'),
    date: text('date').notNull(),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index('transactions_user_date_idx').on(t.userId, t.date),
    index('transactions_user_updated_idx').on(t.userId, t.updatedAt),
    index('transactions_category_idx').on(t.categoryId),
    ...moneyChecks('transactions', t),
    check(
      'transactions_category_by_type',
      sql`(${t.type} = 'expense' AND ${t.categoryId} IS NOT NULL)
        OR (${t.type} = 'income' AND ${t.categoryId} IS NULL)`,
    ),
  ],
);

export const recurringPayments = sqliteTable(
  'recurring_payments',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    amountDa: integer('amount_da').notNull(),
    categoryId: text('category_id').notNull(),
    frequency: text('frequency', { enum: ['monthly', 'yearly'] }).notNull(),
    dayOfMonth: integer('day_of_month').notNull(),
    // 1–12 si yearly, null si monthly.
    month: integer('month'),
    startDate: text('start_date').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull(),
    note: text('note'),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index('recurring_payments_user_updated_idx').on(t.userId, t.updatedAt),
    index('recurring_payments_category_idx').on(t.categoryId),
    check('recurring_payments_amount_positive', sql`${t.amountDa} > 0`),
    check('recurring_payments_day_range', sql`${t.dayOfMonth} BETWEEN 1 AND 31`),
    check(
      'recurring_payments_month_by_frequency',
      sql`(${t.frequency} = 'monthly' AND ${t.month} IS NULL)
        OR (${t.frequency} = 'yearly' AND ${t.month} IS NOT NULL AND ${t.month} BETWEEN 1 AND 12)`,
    ),
    check('recurring_payments_name_not_empty', sql`length(trim(${t.name})) > 0`),
  ],
);

// Une ligne par échéance payée (les échéances dues sont calculées, jamais pré-générées).
export const recurringOccurrences = sqliteTable(
  'recurring_occurrences',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    recurringPaymentId: text('recurring_payment_id').notNull(),
    dueDate: text('due_date').notNull(),
    paidAt: text('paid_at').notNull(),
    transactionId: text('transaction_id').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('recurring_occurrences_payment_due_unique').on(
      t.userId,
      t.recurringPaymentId,
      t.dueDate,
    ),
    index('recurring_occurrences_user_updated_idx').on(t.userId, t.updatedAt),
  ],
);

export const debtPeople = sqliteTable(
  'debt_people',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    // Unique par utilisateur, insensible à la casse (les accents sont comparés côté app).
    uniqueIndex('debt_people_user_name_unique').on(t.userId, sql`lower(${t.name})`),
    index('debt_people_user_updated_idx').on(t.userId, t.updatedAt),
    check('debt_people_name_not_empty', sql`length(trim(${t.name})) > 0`),
  ],
);

export const debts = sqliteTable(
  'debts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    direction: text('direction', { enum: ['i_owe', 'owed_to_me'] }).notNull(),
    personId: text('person_id').notNull(),
    ...money,
    date: text('date').notNull(),
    note: text('note'),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index('debts_user_direction_idx').on(t.userId, t.direction),
    index('debts_user_updated_idx').on(t.userId, t.updatedAt),
    index('debts_person_idx').on(t.personId),
    ...moneyChecks('debts', t),
  ],
);

export const debtRepayments = sqliteTable(
  'debt_repayments',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    debtId: text('debt_id').notNull(),
    ...money,
    date: text('date').notNull(),
    note: text('note'),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index('debt_repayments_debt_idx').on(t.debtId),
    index('debt_repayments_user_updated_idx').on(t.userId, t.updatedAt),
    ...moneyChecks('debt_repayments', t),
  ],
);

// Tables locales uniquement (jamais synchronisées).

export const SYNCED_TABLES = [
  'categories',
  'transactions',
  'recurring_payments',
  'recurring_occurrences',
  'debt_people',
  'debts',
  'debt_repayments',
] as const;

export type SyncedTableName = (typeof SYNCED_TABLES)[number];

// Table Drizzle de chaque table synchronisée (outil d'écriture, synchro).
export const syncedTables = {
  categories,
  transactions,
  recurring_payments: recurringPayments,
  recurring_occurrences: recurringOccurrences,
  debt_people: debtPeople,
  debts,
  debt_repayments: debtRepayments,
} as const satisfies Record<SyncedTableName, unknown>;

// File d'attente des écritures à envoyer à Supabase (écrite dans la même transaction que la ligne).
export const syncQueue = sqliteTable(
  'sync_queue',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    tableName: text('table_name', { enum: SYNCED_TABLES }).notNull(),
    rowId: text('row_id').notNull(),
    op: text('op', { enum: ['upsert'] }).notNull(),
    payload: text('payload', { mode: 'json' }).notNull().$type<Record<string, unknown>>(),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('sync_queue_user_created_idx').on(t.userId, t.createdAt)],
);

// Réglages clé/valeur par utilisateur : last_eur_rate, last_pulled_at, last_synced_at.
export const settings = sqliteTable(
  'settings',
  {
    userId: text('user_id').notNull(),
    key: text('key', { enum: ['last_eur_rate', 'last_pulled_at', 'last_synced_at'] }).notNull(),
    value: text('value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

export type CategoryRow = typeof categories.$inferSelect;
export type NewCategoryRow = typeof categories.$inferInsert;
export type TransactionRow = typeof transactions.$inferSelect;
export type NewTransactionRow = typeof transactions.$inferInsert;
export type RecurringPaymentRow = typeof recurringPayments.$inferSelect;
export type NewRecurringPaymentRow = typeof recurringPayments.$inferInsert;
export type RecurringOccurrenceRow = typeof recurringOccurrences.$inferSelect;
export type NewRecurringOccurrenceRow = typeof recurringOccurrences.$inferInsert;
export type DebtPersonRow = typeof debtPeople.$inferSelect;
export type NewDebtPersonRow = typeof debtPeople.$inferInsert;
export type DebtRow = typeof debts.$inferSelect;
export type NewDebtRow = typeof debts.$inferInsert;
export type DebtRepaymentRow = typeof debtRepayments.$inferSelect;
export type NewDebtRepaymentRow = typeof debtRepayments.$inferInsert;
export type SyncQueueRow = typeof syncQueue.$inferSelect;
export type NewSyncQueueRow = typeof syncQueue.$inferInsert;
export type SettingKey = (typeof settings.$inferSelect)['key'];
