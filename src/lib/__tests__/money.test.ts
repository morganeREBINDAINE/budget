import {
  amountToInput,
  daToEur,
  editAmountInput,
  eurCentsToDa,
  formatAmountInput,
  MAX_AMOUNT_DA,
  parseAmount,
  parseDecimal,
  parseEurCents,
} from '@/lib/money';

const NBSP = ' ';
// "10 000" écrit avec des espaces normaux → espaces insécables, pour la lisibilité des tests.
const nb = (s: string) => s.replace(/ /g, NBSP);

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

describe('daToEur', () => {
  it("arrondit à l'euro le plus proche", () => {
    expect(daToEur(25_000, 250)).toBe(100);
    expect(daToEur(625, 250)).toBe(3); // 2,5 → 3
    expect(daToEur(1_249, 250)).toBe(5); // 4,996 → 5
    expect(daToEur(100, 250)).toBe(0); // 0,4 → 0
  });

  it('arrondit les montants négatifs comme les positifs', () => {
    expect(daToEur(-625, 250)).toBe(-3);
    expect(daToEur(-1_249, 250.5)).toBe(-5);
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

describe('formatAmountInput', () => {
  it('groupe la partie entière par 3 chiffres avec un espace insécable', () => {
    expect(formatAmountInput('10000')).toBe(nb('10 000'));
    expect(formatAmountInput('999')).toBe('999');
    expect(formatAmountInput('1234567')).toBe(nb('1 234 567'));
    expect(formatAmountInput('')).toBe('');
  });

  it('regroupe une saisie déjà espacée ou collée avec des espaces', () => {
    expect(formatAmountInput('1 0000')).toBe(nb('10 000'));
    expect(formatAmountInput(nb('100 0'))).toBe(nb('1 000'));
  });

  it('garde les décimales telles quelles, point remplacé par une virgule', () => {
    expect(formatAmountInput('12500,5')).toBe(nb('12 500,5'));
    expect(formatAmountInput('12500.50')).toBe(nb('12 500,50'));
    expect(formatAmountInput('1000,')).toBe(nb('1 000,'));
    expect(formatAmountInput('1,234')).toBe('1,234');
  });

  it('laisse intacte une saisie invalide (erreur affichée à la validation)', () => {
    expect(formatAmountInput('-3000')).toBe('-3000');
    expect(formatAmountInput('1,2,3')).toBe('1,2,3');
    expect(formatAmountInput('12abc')).toBe('12abc');
  });

  it('reste lisible par parseAmount', () => {
    expect(parseAmount(formatAmountInput('1234567'), 'DZD', '')).toMatchObject({
      ok: true,
      value: { amountDa: 1234567 },
    });
    expect(parseAmount(formatAmountInput('1000,5'), 'EUR', '250')).toMatchObject({
      ok: true,
      value: { originalAmountCents: 100050 },
    });
  });
});

describe('editAmountInput', () => {
  it('chiffre tapé en fin de saisie : curseur en fin', () => {
    expect(editAmountInput(nb('1 000'), nb('1 0000'), 5)).toEqual({ text: nb('10 000'), caret: 6 });
  });

  it('chiffre tapé au milieu : curseur juste après lui', () => {
    // "1|000" → "15|000" → "15 000", curseur après le 5.
    expect(editAmountInput(nb('1 000'), nb('15 000'), 1)).toEqual({ text: nb('15 000'), caret: 2 });
  });

  it("effacer l'espace de groupement efface le chiffre qui le précède", () => {
    // "10 |000" + retour arrière → "1 000", curseur après le 1.
    expect(editAmountInput(nb('10 000'), '10000', 3)).toEqual({ text: nb('1 000'), caret: 1 });
  });

  it('remplacement de toute la sélection par un collage', () => {
    expect(editAmountInput(nb('1 000'), '250000', 5)).toEqual({ text: nb('250 000'), caret: 7 });
  });
});

describe('amountToInput', () => {
  it('pré-remplit un montant formaté', () => {
    expect(amountToInput({ amountDa: 25000, currency: 'DZD', originalAmountCents: null })).toBe(
      nb('25 000'),
    );
    expect(amountToInput({ amountDa: 312625, currency: 'EUR', originalAmountCents: 125050 })).toBe(
      nb('1 250,5'),
    );
  });
});
