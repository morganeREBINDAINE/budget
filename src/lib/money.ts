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
