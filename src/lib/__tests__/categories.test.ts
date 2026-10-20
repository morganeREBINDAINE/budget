import { validateCategoryName } from '@/lib/categories';

const categories = [
  { id: 'a', name: 'Voiture' },
  { id: 'b', name: 'Électricité' },
];

describe('validateCategoryName', () => {
  it('accepte un nom libre, ou le nom actuel de la catégorie', () => {
    expect(validateCategoryName('Loisirs', 'a', categories)).toBeNull();
    expect(validateCategoryName('  Voiture ', 'a', categories)).toBeNull();
  });

  it('refuse un nom vide ou trop long', () => {
    expect(validateCategoryName('   ', 'a', categories)).toBe('Saisis un nom.');
    expect(validateCategoryName('x'.repeat(21), 'a', categories)).toBe('20 caractères maximum.');
    expect(validateCategoryName(` ${'x'.repeat(20)} `, 'a', categories)).toBeNull();
  });

  it("refuse le nom d'une autre catégorie, sans tenir compte de la casse ni des accents", () => {
    const error = 'Une autre catégorie porte déjà ce nom.';
    expect(validateCategoryName('voiture', 'b', categories)).toBe(error);
    expect(validateCategoryName('ELECTRICITE', 'a', categories)).toBe(error);
  });
});
