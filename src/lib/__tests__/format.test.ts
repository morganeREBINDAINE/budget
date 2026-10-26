import { formatYearWindow, yearWindowBounds } from '@/lib/format';

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
