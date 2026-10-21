import { eurCentsToDa, MAX_AMOUNT_DA, parseAmount, parseDecimal, parseEurCents } from '@/lib/money';

describe('parseDecimal', () => {
  it('accepte la virgule, le point et les espaces', () => {
    expect(parseDecimal('12 500,5')).toBe(12500.5);
    expect(parseDecimal('12.5')).toBe(12.5);
    expect(parseDecimal('12 500')).toBe(12500);
  });

  it('refuse le vide et les saisies invalides', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('-3')).toBeNull();
    expect(parseDecimal('1,2,3')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });
});

describe('parseEurCents', () => {
  it('convertit en centimes sans erreur de flottant', () => {
    expect(parseEurCents('12')).toBe(1200);
    expect(parseEurCents('12,5')).toBe(1250);
    expect(parseEurCents('0,07')).toBe(7);
    expect(parseEurCents('1,15')).toBe(115);
    expect(parseEurCents('1 234,56')).toBe(123456);
  });

  it('refuse plus de 2 décimales et les saisies invalides', () => {
    expect(parseEurCents('1,234')).toBeNull();
    expect(parseEurCents('')).toBeNull();
    expect(parseEurCents(',5')).toBeNull();
  });
});

describe('eurCentsToDa', () => {
  it('arrondit au dinar le plus proche', () => {
    expect(eurCentsToDa(1000, 250)).toBe(2500);
    expect(eurCentsToDa(1, 250)).toBe(3); // 2,5 → 3
    expect(eurCentsToDa(1, 249)).toBe(2); // 2,49 → 2
    expect(eurCentsToDa(1999, 250.5)).toBe(5007); // 5007,495 → 5007
  });
});

describe('parseAmount', () => {
  it('DA : montant entier, sans champs EUR', () => {
    expect(parseAmount('12 500', 'DZD', '')).toEqual({
      ok: true,
      value: { amountDa: 12500, currency: 'DZD', originalAmountCents: null, eurRate: null },
    });
  });

  it('DA : refuse 0, les décimales et les montants trop élevés', () => {
    expect(parseAmount('0', 'DZD', '')).toEqual({
      ok: false,
      errors: { amount: 'Saisis un montant supérieur à 0.' },
    });
    expect(parseAmount('', 'DZD', '')).toMatchObject({ ok: false });
    expect(parseAmount('12,5', 'DZD', '')).toEqual({
      ok: false,
      errors: { amount: 'Le montant en dinars doit être un nombre entier.' },
    });
    expect(parseAmount(String(MAX_AMOUNT_DA), 'DZD', '')).toMatchObject({ ok: true });
    expect(parseAmount(String(MAX_AMOUNT_DA + 1), 'DZD', '')).toEqual({
      ok: false,
      errors: { amount: 'Montant trop élevé.' },
    });
  });

  it('EUR : centimes, taux et montant converti', () => {
    expect(parseAmount('12,50', 'EUR', '250,5')).toEqual({
      ok: true,
      value: { amountDa: 3131, currency: 'EUR', originalAmountCents: 1250, eurRate: 250.5 },
    });
  });

  it('EUR : erreurs du montant et du taux affichées ensemble', () => {
    expect(parseAmount('0', 'EUR', '')).toEqual({
      ok: false,
      errors: {
        amount: 'Saisis un montant supérieur à 0.',
        rate: 'Saisis un taux supérieur à 0.',
      },
    });
    expect(parseAmount('10', 'EUR', '0')).toEqual({
      ok: false,
      errors: { rate: 'Saisis un taux supérieur à 0.' },
    });
  });

  it('EUR : refuse plus de 2 décimales', () => {
    expect(parseAmount('1,234', 'EUR', '250')).toEqual({
      ok: false,
      errors: { amount: 'Deux décimales au maximum.' },
    });
  });

  it('EUR : refuse un montant converti nul ou trop élevé', () => {
    expect(parseAmount('0,01', 'EUR', '10')).toEqual({
      ok: false,
      errors: { amount: 'Montant trop faible une fois converti en dinars.' },
    });
    expect(parseAmount('10000000', 'EUR', '250')).toEqual({
      ok: false,
      errors: { amount: 'Montant trop élevé.' },
    });
    expect(parseAmount('9 999 999,99', 'EUR', '250')).toEqual({
      ok: false,
      errors: { amount: 'Montant trop élevé une fois converti en dinars.' },
    });
  });
});
