import { MAX_AMOUNT_DA, parseDecimal } from '@/lib/money';
import { toIsoDate } from '@/lib/format';
import type { DuePayment, RecurringFrequency, RecurringPayment } from '@/types/budget';

// Échéances des paiements réguliers, calculées côté client (rien n'est pré-généré) :
// - une échéance par période (mois, ou année en annuel), jour 31 → dernier jour du mois,
//   29 février → 28 hors année bissextile ;
// - aucune échéance avant la date de début ni avant la création du paiement (pas d'arriéré
//   à la création, ni à la réactivation : la date de début est alors ramenée à aujourd'hui) ;
// - une occurrence payée couvre toute sa période : changer le jour ou le mois d'un paiement
//   déjà payé ne fait pas réapparaître d'encart. Les occurrences et dépenses enregistrées ne
//   sont jamais modifiées.

export const RECURRING_NAME_MAX_LENGTH = 30;
export const RECURRING_NOTE_MAX_LENGTH = 100;

type Schedule = Pick<
  RecurringPayment,
  'frequency' | 'dayOfMonth' | 'month' | 'startDate' | 'active' | 'createdAt'
>;

const pad = (n: number) => String(n).padStart(2, '0');

const lastDayOfMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

/** Date d'échéance d'un mois donné (jour ramené au dernier jour des mois plus courts). */
export function dueDateIn(year: number, month: number, dayOfMonth: number): string {
  return `${year}-${pad(month)}-${pad(Math.min(dayOfMonth, lastDayOfMonth(year, month)))}`;
}

/** Période couverte par une date : « YYYY-MM » en mensuel, « YYYY » en annuel. */
export function periodOf(frequency: RecurringFrequency, date: string): string {
  return frequency === 'monthly' ? date.slice(0, 7) : date.slice(0, 4);
}

/** Première date possible d'échéance : la plus tardive entre la date de début et la création. */
export function firstPossibleDueDate(p: Pick<Schedule, 'startDate' | 'createdAt'>): string {
  const created = toIsoDate(new Date(p.createdAt));
  return p.startDate > created ? p.startDate : created;
}

// Échéance de chaque période à partir de celle qui contient `from` (générateur sans fin).
function* dueDatesFrom(p: Schedule, from: string): Generator<string> {
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  if (p.frequency === 'yearly') {
    for (;;) {
      yield dueDateIn(year, p.month ?? 1, p.dayOfMonth);
      year += 1;
    }
  }
  for (;;) {
    yield dueDateIn(year, month, p.dayOfMonth);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
}

/**
 * Échéances arrivées (≤ aujourd'hui) et non payées d'un paiement, de la plus ancienne à la plus
 * récente. `paidDueDates` : dates d'échéance de ses occurrences enregistrées.
 */
export function dueDatesOf(p: Schedule, paidDueDates: readonly string[], today: string): string[] {
  if (!p.active) return [];
  const first = firstPossibleDueDate(p);
  if (first > today) return [];
  const paid = new Set(paidDueDates.map((d) => periodOf(p.frequency, d)));
  const result: string[] = [];
  for (const due of dueDatesFrom(p, first)) {
    if (due > today) break;
    if (due >= first && !paid.has(periodOf(p.frequency, due))) result.push(due);
  }
  return result;
}

/**
 * Prochaine échéance à afficher dans la liste : la plus ancienne non payée si elle est arrivée
 * (en retard ou aujourd'hui), sinon la prochaine à venir ; null si le paiement est inactif.
 */
export function nextDueDate(
  p: Schedule,
  paidDueDates: readonly string[],
  today: string,
): string | null {
  if (!p.active) return null;
  const late = dueDatesOf(p, paidDueDates, today);
  if (late.length > 0) return late[0];
  const first = firstPossibleDueDate(p);
  const from = first > today ? first : today;
  const paid = new Set(paidDueDates.map((d) => periodOf(p.frequency, d)));
  for (const due of dueDatesFrom(p, from)) {
    if (due >= from && !paid.has(periodOf(p.frequency, due))) return due;
  }
  return null; // inatteignable : le générateur est sans fin
}

/** Échéances dues de tous les paiements, de la plus ancienne à la plus récente. */
export function duePaymentsOf(
  payments: readonly RecurringPayment[],
  paidDueDatesByPayment: ReadonlyMap<string, readonly string[]>,
  today: string,
): DuePayment[] {
  return payments
    .flatMap((payment) =>
      dueDatesOf(payment, paidDueDatesByPayment.get(payment.id) ?? [], today).map((dueDate) => ({
        payment,
        dueDate,
      })),
    )
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) || a.payment.name.localeCompare(b.payment.name, 'fr'),
    );
}

/** Saisie brute de l'éditeur. */
export type RecurringInput = {
  name: string;
  amount: string;
  categoryId: string | null;
  frequency: RecurringFrequency;
  dayOfMonth: number | null;
  month: number | null;
  // YYYY-MM-DD
  startDate: string;
  active: boolean;
  note: string;
};

/** Valeurs prêtes à enregistrer (colonnes de `recurring_payments` hors champs gérés). */
export type RecurringValues = {
  name: string;
  amountDa: number;
  categoryId: string;
  frequency: RecurringFrequency;
  dayOfMonth: number;
  month: number | null;
  startDate: string;
  active: boolean;
  note: string | null;
};

export type RecurringErrors = Partial<
  Record<'name' | 'amount' | 'category' | 'day' | 'month' | 'startDate', string>
>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valide la saisie : nom (1 à 30 caractères), montant entier de 1 à MAX_AMOUNT_DA, catégorie
 * existante, jour 1–31, mois 1–12 en annuel (null en mensuel), date de début valide.
 */
export function validateRecurring(
  input: RecurringInput,
  categoryIds: ReadonlySet<string>,
): { ok: true; values: RecurringValues } | { ok: false; errors: RecurringErrors } {
  const errors: RecurringErrors = {};
  const name = input.name.trim();
  if (name === '') errors.name = 'Saisis un nom.';
  else if (name.length > RECURRING_NAME_MAX_LENGTH)
    errors.name = `${RECURRING_NAME_MAX_LENGTH} caractères maximum.`;

  const amount = parseDecimal(input.amount);
  if (amount === null || amount <= 0) errors.amount = 'Saisis un montant supérieur à 0.';
  else if (!Number.isInteger(amount))
    errors.amount = 'Le montant en dinars doit être un nombre entier.';
  else if (amount > MAX_AMOUNT_DA) errors.amount = 'Montant trop élevé.';

  if (!input.categoryId || !categoryIds.has(input.categoryId))
    errors.category = 'Choisis une catégorie.';
  const day = input.dayOfMonth;
  if (day === null || !Number.isInteger(day) || day < 1 || day > 31)
    errors.day = 'Choisis un jour.';
  const yearly = input.frequency === 'yearly';
  if (yearly && (input.month === null || input.month < 1 || input.month > 12))
    errors.month = 'Choisis un mois.';
  if (!ISO_DATE.test(input.startDate)) errors.startDate = 'Choisis une date de début.';

  if (Object.keys(errors).length > 0 || amount === null || day === null || !input.categoryId) {
    return { ok: false, errors };
  }
  const note = input.note.trim().slice(0, RECURRING_NOTE_MAX_LENGTH);
  return {
    ok: true,
    values: {
      name,
      amountDa: amount,
      categoryId: input.categoryId,
      frequency: input.frequency,
      dayOfMonth: day,
      month: yearly ? input.month : null,
      startDate: input.startDate,
      active: input.active,
      note: note === '' ? null : note,
    },
  };
}

/** Vrai si les valeurs validées sont identiques au paiement enregistré (aucune écriture utile). */
export function isRecurringUnchanged(existing: RecurringPayment, v: RecurringValues): boolean {
  return (
    existing.name === v.name &&
    existing.amountDa === v.amountDa &&
    existing.categoryId === v.categoryId &&
    existing.frequency === v.frequency &&
    existing.dayOfMonth === v.dayOfMonth &&
    existing.month === v.month &&
    existing.startDate === v.startDate &&
    existing.active === v.active &&
    existing.note === v.note
  );
}
