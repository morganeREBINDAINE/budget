// Diacritiques combinants (U+0300–U+036F) laissés par la décomposition NFD.
const DIACRITICS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g',
);

// Comparaison de noms insensible à la casse, aux accents et aux espaces autour.
export const normalizeName = (s: string) =>
  s.trim().normalize('NFD').replace(DIACRITICS, '').toLowerCase();
