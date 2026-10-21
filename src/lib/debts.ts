import { formatAmount } from '@/lib/format';
import { parseAmount, type AmountErrors, type StoredAmount } from '@/lib/money';
import { normalizeName } from '@/lib/text';
import type { Debt, DebtRepayment } from '@/types/budget';

// Dettes : indépendantes du budget (aucune transaction créée). Reste dû = montant − Σ
// remboursements, comparés en DA (montant converti au taux saisi si EUR).

export const PERSON_NAME_MAX_LENGTH = 40;
export const DEBT_NOTE_MAX_LENGTH = 100;

/** Reste dû (jamais négatif). */
export const remainingOf = (amountDa: number, repaidDa: number) => Math.max(0, amountDa - repaidDa);

/** Personne correspondant au nom saisi (casse, accents et espaces autour ignorés). */
export function findPerson<P extends { name: string }>(people: readonly P[], name: string) {
  const key = normalizeName(name);
  return people.find((p) => normalizeName(p.name) === key);
}

type MoneyInput = {
  amount: string;
  currency: StoredAmount['currency'];
  rate: string;
  // YYYY-MM-DD
  date: string;
  note: string;
};

export type DebtInput = MoneyInput & { person: string };

export type DebtValues = StoredAmount & { personName: string; date: string; note: string | null };

export type DebtErrors = AmountErrors & Partial<Record<'person' | 'date', string>>;

export type RepaymentValues = StoredAmount & { date: string; note: string | null };

export type RepaymentErrors = AmountErrors & Partial<Record<'date', string>>;

const cleanNote = (note: string) => {
  const trimmed = note.trim().slice(0, DEBT_NOTE_MAX_LENGTH);
  return trimmed === '' ? null : trimmed;
};

/**
 * Valide une dette : personne requise (40 caractères max), montant (cf. `parseAmount`), date ≤
 * aujourd'hui (le passé est libre), montant ≥ total déjà remboursé (`repaidDa`, 0 à la création).
 */
export function validateDebt(
  input: DebtInput,
  { today, repaidDa }: { today: string; repaidDa: number },
): { ok: true; values: DebtValues } | { ok: false; errors: DebtErrors } {
  const amount = parseAmount(input.amount, input.currency, input.rate);
  const errors: DebtErrors = amount.ok ? {} : { ...amount.errors };
  const personName = input.person.trim();
  if (personName === '') errors.person = 'Saisis le nom de la personne.';
  else if (personName.length > PERSON_NAME_MAX_LENGTH)
    errors.person = `${PERSON_NAME_MAX_LENGTH} caractères maximum.`;
  if (input.date > today) errors.date = 'La date ne peut pas être dans le futur.';
  if (amount.ok && amount.value.amountDa < repaidDa)
    errors.amount = `Le montant ne peut pas être inférieur au total déjà remboursé (${formatAmount(repaidDa)}).`;
  if (!amount.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    values: { ...amount.value, personName, date: input.date, note: cleanNote(input.note) },
  };
}

/**
 * Valide un remboursement : montant (cf. `parseAmount`), date ≤ aujourd'hui, montant ≤ reste dû
 * autorisé (`maxDa` : reste dû, plus le remboursement modifié lui-même).
 */
export function validateRepayment(
  input: MoneyInput,
  { today, maxDa }: { today: string; maxDa: number },
): { ok: true; values: RepaymentValues } | { ok: false; errors: RepaymentErrors } {
  const amount = parseAmount(input.amount, input.currency, input.rate);
  const errors: RepaymentErrors = amount.ok ? {} : { ...amount.errors };
  if (input.date > today) errors.date = 'La date ne peut pas être dans le futur.';
  if (amount.ok && amount.value.amountDa > maxDa)
    errors.amount = `Le remboursement dépasse le reste dû (${formatAmount(maxDa)}).`;
  if (!amount.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, values: { ...amount.value, date: input.date, note: cleanNote(input.note) } };
}

const sameMoney = (a: StoredAmount & { date: string; note: string | null }, b: typeof a) =>
  a.amountDa === b.amountDa &&
  a.currency === b.currency &&
  a.originalAmountCents === b.originalAmountCents &&
  a.eurRate === b.eurRate &&
  a.date === b.date &&
  a.note === b.note;

/** Vrai si rien n'a changé (même personne, mêmes valeurs) : aucune écriture utile. */
export function isDebtUnchanged(existing: Debt, personName: string, v: DebtValues): boolean {
  return personName === v.personName && sameMoney(existing, v);
}

/** Vrai si le remboursement validé est identique à celui enregistré. */
export function isRepaymentUnchanged(existing: DebtRepayment, v: RepaymentValues): boolean {
  return sameMoney(existing, v);
}
