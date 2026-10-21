import { BACKUP_VERSION, parseBackup, serializeBackup, type Backup } from '@/backup/format';
import type { Database } from '@/db/client';
import { SYNCED_TABLES } from '@/db/schema';
import { importBackup, readBackup } from '@/repositories/backup';
import { insertRow, softDeleteRow } from '@/repositories/write';
import { createTestDatabase } from '@/test/testDatabase';

jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));

const USER = 'user-a';
const OTHER_USER = 'user-b';

let db: Database;
let close: () => void;
let minute = 0;

beforeEach(() => {
  ({ db, close } = createTestDatabase());
  minute = 0;
  jest.useFakeTimers({ now: new Date('2026-10-21T08:00:00.000Z') });
});

afterEach(() => {
  jest.useRealTimers();
  close();
});

// Chaque écriture à une minute différente : ordre de création stable.
const tick = () => jest.setSystemTime(new Date(Date.UTC(2026, 9, 21, 8, ++minute)));

function categoriesFor(userId: string, label: string) {
  return Array.from({ length: 9 }, (_, i) => {
    tick();
    return insertRow(db, 'categories', userId, {
      name: `${label} ${i + 1}`,
      color: '#3B82F6',
      icon: 'cart',
      position: i + 1,
    });
  });
}

/** Données complètes : EUR et DA, annuel, occurrences, dette remboursée, lignes supprimées. */
function seed(userId: string) {
  const cats = categoriesFor(userId, 'Catégorie');
  tick();
  const expense = insertRow(db, 'transactions', userId, {
    type: 'expense',
    amountDa: 24000,
    currency: 'EUR',
    originalAmountCents: 10000,
    eurRate: 240,
    categoryId: cats[4].id,
    note: 'Courses',
    date: '2026-10-05',
  });
  tick();
  insertRow(db, 'transactions', userId, {
    type: 'income',
    amountDa: 120000,
    currency: 'DZD',
    categoryId: null,
    date: '2026-10-01',
  });
  tick();
  const removed = insertRow(db, 'transactions', userId, {
    type: 'expense',
    amountDa: 100,
    currency: 'DZD',
    categoryId: cats[0].id,
    date: '2026-10-02',
  });
  tick();
  softDeleteRow(db, 'transactions', userId, removed.id);
  tick();
  const payment = insertRow(db, 'recurring_payments', userId, {
    name: 'Assurance',
    amountDa: 30000,
    categoryId: cats[1].id,
    frequency: 'yearly',
    dayOfMonth: 29,
    month: 2,
    startDate: '2026-01-01',
    active: false,
    note: 'Annuelle',
  });
  tick();
  insertRow(db, 'recurring_occurrences', userId, {
    recurringPaymentId: payment.id,
    dueDate: '2026-02-28',
    paidAt: '2026-03-01',
    transactionId: expense.id,
  });
  tick();
  const oldPayment = insertRow(db, 'recurring_payments', userId, {
    name: 'Ancien',
    amountDa: 500,
    categoryId: cats[1].id,
    frequency: 'monthly',
    dayOfMonth: 31,
    startDate: '2026-01-01',
    active: true,
  });
  tick();
  insertRow(db, 'recurring_occurrences', userId, {
    recurringPaymentId: oldPayment.id,
    dueDate: '2026-01-31',
    paidAt: '2026-01-31',
    transactionId: expense.id,
  });
  tick();
  softDeleteRow(db, 'recurring_payments', userId, oldPayment.id);
  tick();
  const person = insertRow(db, 'debt_people', userId, { name: 'Amel' });
  tick();
  const debt = insertRow(db, 'debts', userId, {
    direction: 'i_owe',
    personId: person.id,
    amountDa: 50000,
    currency: 'DZD',
    date: '2026-09-15',
  });
  tick();
  insertRow(db, 'debt_repayments', userId, {
    debtId: debt.id,
    amountDa: 12000,
    currency: 'EUR',
    originalAmountCents: 5000,
    eurRate: 240,
    date: '2026-10-10',
    note: 'Virement',
  });
}

// Contenu d'une sauvegarde sans ses ids ni ses `updated_at` (recréés à l'import) : chaque id est
// remplacé par sa place dans sa table (par position pour les catégories), références comprises.
// Les catégories sont modifiées sur place à l'import : leur date de création reste celle du compte.
function canonical(backup: Backup) {
  const keys = new Map<string, string>();
  for (const tableName of SYNCED_TABLES) {
    (backup.rows[tableName] as { id: string; position?: number }[]).forEach((row, i) =>
      keys.set(row.id, `${tableName}#${row.position ?? i}`),
    );
  }
  return Object.fromEntries(
    SYNCED_TABLES.map((tableName) => [
      tableName,
      (backup.rows[tableName] as Record<string, unknown>[])
        .map(({ updatedAt: _updatedAt, ...row }) =>
          Object.fromEntries(
            Object.entries(row)
              .filter(([key]) => !(tableName === 'categories' && key === 'createdAt'))
              .map(([key, value]) => [
                key,
                typeof value === 'string' && keys.has(value) ? keys.get(value) : value,
              ]),
          ),
        )
        .sort((a, b) => String(a.id).localeCompare(String(b.id))),
    ]),
  );
}

describe('export → import', () => {
  it('fichier relu identique à la sauvegarde', () => {
    seed(USER);
    const backup = readBackup(db, USER);
    expect(parseBackup(serializeBackup(backup))).toEqual({ ok: true, backup });
  });

  it('fichier : snake_case, sans compte ni lignes supprimées', () => {
    seed(USER);
    const file = JSON.parse(serializeBackup(readBackup(db, USER)));

    expect(Object.keys(file)).toEqual(['version', 'exported_at', ...SYNCED_TABLES]);
    expect(file.version).toBe(BACKUP_VERSION);
    expect(file.transactions).toHaveLength(2);
    expect(file.recurring_payments).toHaveLength(1);
    // Occurrence d'un paiement supprimé : pas exportée.
    expect(file.recurring_occurrences).toHaveLength(1);
    expect(file.transactions[0]).toEqual(
      expect.objectContaining({ amount_da: 24000, original_amount_cents: 10000, eur_rate: 240 }),
    );
    for (const tableName of SYNCED_TABLES) {
      for (const row of file[tableName]) {
        expect(row).not.toHaveProperty('user_id');
        expect(row).not.toHaveProperty('deleted_at');
      }
    }
  });

  it('import dans le même compte : données identiques', () => {
    seed(USER);
    const backup = readBackup(db, USER);
    tick();

    importBackup(db, USER, parseFromFile(backup));

    expect(canonical(readBackup(db, USER))).toEqual(canonical(backup));
  });

  it('import dans un autre compte : données identiques, sans toucher au compte d’origine', () => {
    seed(USER);
    categoriesFor(OTHER_USER, 'Autre');
    const backup = readBackup(db, USER);
    tick();

    importBackup(db, OTHER_USER, parseFromFile(backup));

    expect(canonical(readBackup(db, OTHER_USER))).toEqual(canonical(backup));
    expect(readBackup(db, USER).rows).toEqual(backup.rows);
  });

  it('import répété du même fichier : toujours le même résultat', () => {
    seed(USER);
    const backup = readBackup(db, USER);
    tick();
    importBackup(db, USER, parseFromFile(backup));
    tick();
    importBackup(db, USER, parseFromFile(backup));

    expect(canonical(readBackup(db, USER))).toEqual(canonical(backup));
  });
});

function parseFromFile(backup: Backup): Backup {
  const result = parseBackup(serializeBackup(backup));
  if (!result.ok) throw new Error(result.error);
  return result.backup;
}

describe('rejet des fichiers invalides', () => {
  let file: Record<string, unknown>;

  beforeEach(() => {
    seed(USER);
    file = JSON.parse(serializeBackup(readBackup(db, USER)));
  });

  type Rows = Record<string, unknown>[];
  const rows = (f: Record<string, unknown>, tableName: string) => f[tableName] as Rows;
  const parse = (mutate: (f: Record<string, unknown>) => void) => {
    const copy = structuredClone(file);
    mutate(copy);
    return parseBackup(JSON.stringify(copy));
  };
  const expectError = (result: ReturnType<typeof parseBackup>, error: string) =>
    expect(result).toEqual({ ok: false, error });

  it.each([
    ['pas du JSON', 'nope'],
    ['JSON tronqué', '{"version": 1,'],
  ])('fichier illisible : %s', (_, text) => {
    expectError(parseBackup(text), 'Fichier illisible : ce n’est pas une sauvegarde JSON.');
  });

  it.each([
    ['tableau', '[]'],
    ['texte', '"budget"'],
    ['sans version', '{"exported_at": "2026-10-21T10:00:00.000Z"}'],
    ['version en texte', '{"version": "1"}'],
  ])('pas une sauvegarde : %s', (_, text) => {
    expectError(parseBackup(text), 'Ce fichier n’est pas une sauvegarde de l’application.');
  });

  it('version plus récente', () => {
    expectError(
      parse((f) => (f.version = BACKUP_VERSION + 1)),
      'Cette sauvegarde vient d’une version plus récente de l’application.',
    );
  });

  it.each([0, 0.5])('version inconnue : %s', (version) => {
    expectError(
      parse((f) => (f.version = version)),
      'Version de sauvegarde inconnue.',
    );
  });

  it.each<[string, (f: Record<string, unknown>) => void, string]>([
    ['champ inconnu', (f) => (f.owner = 'x'), 'owner : champ inconnu'],
    [
      'date d’export invalide',
      (f) => (f.exported_at = 'hier'),
      'exported_at : horodatage invalide',
    ],
    ['table manquante', (f) => delete f.debts, 'debts : liste attendue'],
    ['table qui n’est pas une liste', (f) => (f.debts = {}), 'debts : liste attendue'],
    [
      'ligne qui n’est pas un objet',
      (f) => (rows(f, 'debts')[0] = 'x' as never),
      'debts[0] : objet attendu',
    ],
    [
      'colonne inconnue',
      (f) => (rows(f, 'debts')[0].user_id = 'x'),
      'debts[0].user_id : colonne inconnue',
    ],
    [
      'colonne manquante',
      (f) => delete rows(f, 'debts')[0].note,
      'debts[0].note : colonne manquante',
    ],
    [
      'valeur obligatoire nulle',
      (f) => (rows(f, 'debts')[0].date = null),
      'debts[0].date : valeur obligatoire',
    ],
    [
      'texte au lieu d’un nombre',
      (f) => (rows(f, 'debts')[0].amount_da = '500'),
      'debts[0].amount_da : entier attendu',
    ],
    [
      'décimal au lieu d’un entier',
      (f) => (rows(f, 'debts')[0].amount_da = 1.5),
      'debts[0].amount_da : entier attendu',
    ],
    [
      'booléen invalide',
      (f) => (rows(f, 'recurring_payments')[0].active = 1),
      'recurring_payments[0].active : booléen attendu',
    ],
    [
      'taux non numérique',
      (f) => (rows(f, 'transactions')[0].eur_rate = '240'),
      'transactions[0].eur_rate : nombre attendu',
    ],
    [
      'valeur d’enum inconnue',
      (f) => (rows(f, 'debts')[0].direction = 'both'),
      'debts[0].direction : valeur inconnue',
    ],
    [
      'identifiant invalide',
      (f) => (rows(f, 'debts')[0].id = 'debt-1'),
      'debts[0].id : identifiant invalide',
    ],
    [
      'date impossible',
      (f) => (rows(f, 'debts')[0].date = '2026-02-30'),
      'debts[0].date : date invalide',
    ],
    [
      'date mal formée',
      (f) => (rows(f, 'debts')[0].date = '21/10/2026'),
      'debts[0].date : date invalide',
    ],
    [
      'horodatage invalide',
      (f) => (rows(f, 'debts')[0].created_at = 'x'),
      'debts[0].created_at : horodatage invalide',
    ],
  ])('structure : %s', (_, mutate, detail) => {
    expectError(parse(mutate), `Sauvegarde invalide (${detail}).`);
  });

  it.each<[string, (f: Record<string, unknown>) => void, string]>([
    ['8 catégories', (f) => rows(f, 'categories').pop(), 'categories : 9 catégories attendues'],
    [
      'position en double',
      (f) => (rows(f, 'categories')[1].position = 1),
      'categories[1].position : position en double',
    ],
    [
      'position hors limites',
      (f) => (rows(f, 'categories')[8].position = 10),
      'categories[8].position : position hors limites',
    ],
    [
      'couleur invalide',
      (f) => (rows(f, 'categories')[0].color = 'bleu'),
      'categories[0].color : couleur invalide',
    ],
    [
      'nom de catégorie vide',
      (f) => (rows(f, 'categories')[0].name = '  '),
      'categories[0].name : nom vide',
    ],
    ['icône vide', (f) => (rows(f, 'categories')[0].icon = ''), 'categories[0].icon : icône vide'],
    [
      'id en double',
      (f) => (rows(f, 'transactions')[1].id = rows(f, 'transactions')[0].id),
      'transactions[1].id : identifiant en double',
    ],
    [
      'dépense sans catégorie',
      (f) => (rows(f, 'transactions')[0].category_id = null),
      'transactions[0].category_id : catégorie introuvable',
    ],
    [
      'catégorie inconnue',
      (f) => (rows(f, 'transactions')[0].category_id = '00000000-0000-4000-8000-000000000000'),
      'transactions[0].category_id : catégorie introuvable',
    ],
    [
      'entrée avec catégorie',
      (f) => (rows(f, 'transactions')[1].category_id = rows(f, 'categories')[0].id),
      'transactions[1].category_id : une entrée n’a pas de catégorie',
    ],
    [
      'montant nul',
      (f) => (rows(f, 'transactions')[1].amount_da = 0),
      'transactions[1].amount_da : hors limites',
    ],
    [
      'montant trop grand',
      (f) => (rows(f, 'transactions')[1].amount_da = 1_000_000_000),
      'transactions[1].amount_da : hors limites',
    ],
    [
      'DA avec champs EUR',
      (f) => (rows(f, 'transactions')[1].eur_rate = 240),
      'transactions[1] : montant EUR renseigné pour une saisie en DA',
    ],
    [
      'EUR sans montant d’origine',
      (f) => (rows(f, 'transactions')[0].original_amount_cents = null),
      'transactions[0].original_amount_cents : hors limites',
    ],
    [
      'EUR avec taux nul',
      (f) => (rows(f, 'transactions')[0].eur_rate = 0),
      'transactions[0].eur_rate : taux invalide',
    ],
    [
      'paiement mensuel avec mois',
      (f) => Object.assign(rows(f, 'recurring_payments')[0], { frequency: 'monthly' }),
      'recurring_payments[0].month : pas de mois pour un paiement mensuel',
    ],
    [
      'paiement annuel sans mois',
      (f) => (rows(f, 'recurring_payments')[0].month = null),
      'recurring_payments[0].month : mois hors limites',
    ],
    [
      'jour hors limites',
      (f) => (rows(f, 'recurring_payments')[0].day_of_month = 32),
      'recurring_payments[0].day_of_month : jour hors limites',
    ],
    [
      'paiement inconnu',
      (f) =>
        (rows(f, 'recurring_occurrences')[0].recurring_payment_id =
          '00000000-0000-4000-8000-000000000000'),
      'recurring_occurrences[0].recurring_payment_id : paiement régulier introuvable',
    ],
    [
      'échéance en double',
      (f) =>
        rows(f, 'recurring_occurrences').push({
          ...rows(f, 'recurring_occurrences')[0],
          id: '00000000-0000-4000-8000-000000000001',
        }),
      'recurring_occurrences[1].due_date : échéance en double',
    ],
    [
      'personne inconnue',
      (f) => (rows(f, 'debts')[0].person_id = '00000000-0000-4000-8000-000000000000'),
      'debts[0].person_id : personne introuvable',
    ],
    [
      'nom de personne en double (accents et casse)',
      (f) =>
        rows(f, 'debt_people').push({
          ...rows(f, 'debt_people')[0],
          id: '00000000-0000-4000-8000-000000000001',
          name: 'amél',
        }),
      'debt_people[1].name : nom en double',
    ],
    [
      'dette inconnue',
      (f) => (rows(f, 'debt_repayments')[0].debt_id = '00000000-0000-4000-8000-000000000000'),
      'debt_repayments[0].debt_id : dette introuvable',
    ],
    [
      'remboursements supérieurs à la dette',
      (f) =>
        Object.assign(rows(f, 'debt_repayments')[0], {
          currency: 'DZD',
          original_amount_cents: null,
          eur_rate: null,
          amount_da: 50001,
        }),
      'debt_repayments[0].amount_da : remboursements supérieurs à la dette',
    ],
  ])('règles : %s', (_, mutate, detail) => {
    expectError(parse(mutate), `Sauvegarde invalide (${detail}).`);
  });

  it('le message ne cite ni montant ni note', () => {
    const result = parse((f) =>
      Object.assign(rows(f, 'transactions')[0], { note: 'Secret', amount_da: 0 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toContain('Secret');
      expect(result.error).not.toMatch(/\d{3}/);
    }
  });
});
