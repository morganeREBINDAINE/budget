import type { Category } from '@/types/budget';

import { normalizeName } from './text';

/** Nombre fixe de catégories d'un compte (positions 1 à CATEGORY_COUNT). */
export const CATEGORY_COUNT = 12;

export const CATEGORY_NAME_MAX_LENGTH = 20;

/**
 * Erreur de saisie du nom d'une catégorie, `null` s'il est valide : non vide, 20 caractères au plus,
 * pas déjà utilisé par une autre catégorie (sans tenir compte de la casse ni des accents).
 */
export function validateCategoryName(
  name: string,
  categoryId: string,
  categories: readonly Pick<Category, 'id' | 'name'>[],
): string | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'Saisis un nom.';
  if (trimmed.length > CATEGORY_NAME_MAX_LENGTH)
    return `${CATEGORY_NAME_MAX_LENGTH} caractères maximum.`;
  const normalized = normalizeName(trimmed);
  if (categories.some((c) => c.id !== categoryId && normalizeName(c.name) === normalized))
    return 'Une autre catégorie porte déjà ce nom.';
  return null;
}
