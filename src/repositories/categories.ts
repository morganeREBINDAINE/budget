import { and, asc, eq, isNull } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { categories } from '@/db/schema';
import { updateRow } from '@/repositories/write';
import type { Category } from '@/types/budget';

// Catégories du compte (12, positions 1 à 12) : lecture réactive et modification via l'outil commun.

const categoryColumns = {
  id: categories.id,
  name: categories.name,
  color: categories.color,
  icon: categories.icon,
  position: categories.position,
};

const visibleTo = (userId: string) =>
  and(eq(categories.userId, userId), isNull(categories.deletedAt));

/** Catégories non supprimées du compte, triées par position (à passer à `useLiveQuery`). */
export function categoriesQuery(db: Database, userId: string) {
  return db
    .select(categoryColumns)
    .from(categories)
    .where(visibleTo(userId))
    .orderBy(asc(categories.position));
}

/** Une catégorie non supprimée du compte (0 ou 1 ligne, à passer à `useLiveQuery`). */
export function categoryQuery(db: Database, userId: string, id: string) {
  return db
    .select(categoryColumns)
    .from(categories)
    .where(and(visibleTo(userId), eq(categories.id, id)))
    .limit(1);
}

export type CategoryPatch = Pick<Category, 'name' | 'color' | 'icon'>;

/** Modifie nom, couleur et icône ; `RowNotFoundError` si la catégorie est supprimée ou d'un autre compte. */
export function updateCategory(
  db: Database,
  userId: string,
  id: string,
  patch: CategoryPatch,
): Category {
  const row = updateRow(db, 'categories', userId, id, patch);
  return { id: row.id, name: row.name, color: row.color, icon: row.icon, position: row.position };
}
