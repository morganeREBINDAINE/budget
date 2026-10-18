// Saisie utilisateur → nombre ("12 500,5" → 12500.5). Renvoie null si invalide ou vide.
export function parseDecimal(input: string): number | null {
  const normalized = input.replace(/[\s ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

// Conversion EUR → DA, arrondie au dinar.
export function eurToDa(amountEur: number, rate: number): number {
  return Math.round(amountEur * rate);
}

// Nombre → saisie française ("12.5" → "12,5").
export const toDecimalInput = (n: number) => String(n).replace('.', ',');

type StoredAmount = {
  amountDa: number;
  currency: 'DZD' | 'EUR';
  originalAmountCents: number | null;
};

// Montant enregistré → valeur du champ : montant EUR saisi si EUR, sinon dinars.
export function amountToInput(a: StoredAmount): string {
  if (a.currency === 'EUR' && a.originalAmountCents !== null)
    return toDecimalInput(a.originalAmountCents / 100);
  return String(a.amountDa);
}
