import type { Currency } from '@/types/budget';

// Bornes des montants : `amount_da` et `original_amount_cents` sont des `integer` Postgres
// (≈ 2,1 milliards au plus), une valeur plus grande serait refusée à la synchro.
export const MAX_AMOUNT_DA = 999_999_999;
export const MAX_AMOUNT_EUR_CENTS = 999_999_999; // 9 999 999,99 €

// Saisie utilisateur → nombre ("12 500,5" → 12500.5). Renvoie null si invalide ou vide.
export function parseDecimal(input: string): number | null {
  const normalized = input.replace(/[\s ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

// Saisie EUR → centimes entiers ("12,5" → 1250), sans passer par un flottant.
// Renvoie null si invalide, vide ou avec plus de 2 décimales.
export function parseEurCents(input: string): number | null {
  const normalized = input.replace(/[\s ]/g, '').replace(',', '.');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

// Conversion EUR → DA, arrondie au dinar.
export function eurToDa(amountEur: number, rate: number): number {
  return Math.round(amountEur * rate);
}

// Centimes EUR → DA, arrondi au dinar : round(centimes / 100 × taux).
export function eurCentsToDa(cents: number, rate: number): number {
  return Math.round((cents * rate) / 100);
}

// Nombre → saisie française ("12.5" → "12,5").
export const toDecimalInput = (n: number) => String(n).replace('.', ',');

/** Partie « montant » enregistrée (transactions, dettes, remboursements). */
export type StoredAmount = {
  amountDa: number;
  currency: Currency;
  originalAmountCents: number | null;
  eurRate: number | null;
};

// Montant enregistré → valeur du champ : montant EUR saisi si EUR, sinon dinars.
export function amountToInput(
  a: Pick<StoredAmount, 'amountDa' | 'currency' | 'originalAmountCents'>,
): string {
  if (a.currency === 'EUR' && a.originalAmountCents !== null)
    return toDecimalInput(a.originalAmountCents / 100);
  return String(a.amountDa);
}

export type AmountErrors = Partial<Record<'amount' | 'rate', string>>;

/**
 * Saisie montant (+ taux si EUR) → montant à enregistrer, ou erreurs à afficher sous les champs.
 * DA : entier de 1 à MAX_AMOUNT_DA. EUR : 2 décimales au plus, taux > 0, montant converti ≥ 1 DA.
 */
export function parseAmount(
  amount: string,
  currency: Currency,
  rate: string,
): { ok: true; value: StoredAmount } | { ok: false; errors: AmountErrors } {
  if (currency === 'DZD') {
    const value = parseDecimal(amount);
    if (value === null || value <= 0) return fail('amount', 'Saisis un montant supérieur à 0.');
    if (!Number.isInteger(value))
      return fail('amount', 'Le montant en dinars doit être un nombre entier.');
    if (value > MAX_AMOUNT_DA) return fail('amount', 'Montant trop élevé.');
    return {
      ok: true,
      value: { amountDa: value, currency, originalAmountCents: null, eurRate: null },
    };
  }

  const errors: AmountErrors = {};
  const cents = parseEurCents(amount);
  const decimal = parseDecimal(amount);
  if (cents === null && decimal !== null && decimal > 0)
    errors.amount = 'Deux décimales au maximum.';
  else if (cents === null || cents <= 0) errors.amount = 'Saisis un montant supérieur à 0.';
  else if (cents > MAX_AMOUNT_EUR_CENTS) errors.amount = 'Montant trop élevé.';
  const rateValue = parseDecimal(rate);
  if (rateValue === null || rateValue <= 0) errors.rate = 'Saisis un taux supérieur à 0.';
  if (errors.amount || errors.rate || cents === null || rateValue === null) {
    return { ok: false, errors };
  }

  const amountDa = eurCentsToDa(cents, rateValue);
  if (amountDa < 1) return fail('amount', 'Montant trop faible une fois converti en dinars.');
  if (amountDa > MAX_AMOUNT_DA)
    return fail('amount', 'Montant trop élevé une fois converti en dinars.');
  return {
    ok: true,
    value: { amountDa, currency, originalAmountCents: cents, eurRate: rateValue },
  };
}

const fail = (key: keyof AmountErrors, message: string) =>
  ({ ok: false, errors: { [key]: message } }) as const;
