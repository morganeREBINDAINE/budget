import { formatAmount, formatYearWindow, yearWindowBounds } from '@/lib/format';

const NBSP = ' ';
// Montants écrits avec des espaces normaux → espaces insécables, pour la lisibilité des tests.
const nb = (s: string) => s.replace(/ /g, NBSP);

describe('yearWindowBounds', () => {
  it('12 mois finissant au mois donné inclus', () => {
    expect(yearWindowBounds({ year: 2026, month: 10 })).toEqual({
      start: '2025-11-01',
      end: '2026-11-01',
    });
  });

  it('décembre : fenêtre sur l’année civile, fin au 1er janvier suivant', () => {
    expect(yearWindowBounds({ year: 2026, month: 12 })).toEqual({
      start: '2026-01-01',
      end: '2027-01-01',
    });
  });
});

describe('formatYearWindow', () => {
  it('premier et dernier mois abrégés, avec leur année', () => {
    expect(formatYearWindow({ year: 2026, month: 10 })).toBe('Nov. 2025 – Oct. 2026');
    expect(formatYearWindow({ year: 2026, month: 4 })).toBe('Mai 2025 – Avr. 2026');
  });
});

describe('formatAmount', () => {
  it('en dinars par défaut', () => {
    expect(formatAmount(12_500)).toBe(nb('12 500 DA'));
    expect(formatAmount(-12_500, { signed: true })).toBe(nb('−12 500 DA'));
    expect(formatAmount(12_500, { signed: true })).toBe(nb('+12 500 DA'));
  });

  it('en euros entiers avec un taux', () => {
    expect(formatAmount(312_500, { eurRate: 250 })).toBe(nb('1 250 €'));
    expect(formatAmount(-625, { signed: true, eurRate: 250 })).toBe(nb('−3 €'));
    expect(formatAmount(625, { signed: true, eurRate: 250 })).toBe(nb('+3 €'));
  });

  it('sans signe quand le montant converti vaut 0', () => {
    expect(formatAmount(-100, { signed: true, eurRate: 250 })).toBe(nb('0 €'));
  });
});
