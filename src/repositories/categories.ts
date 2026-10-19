import { sql } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { categories, type NewCategoryRow } from '@/db/schema';

/**
 * Enregistre des catégories venues de Supabase (pull). Insère les nouvelles et ne remplace une
 * ligne existante que si la version distante est plus récente (`updated_at`) : une modification
 * locale encore en file d'attente n'est jamais écrasée.
 */
export async function saveRemoteCategories(
  db: Database,
  userId: string,
  rows: NewCategoryRow[],
): Promise<void> {
  if (rows.length === 0) return;
  if (rows.some((row) => row.userId !== userId)) {
    throw new Error('Catégories d’un autre compte refusées');
  }
  await db
    .insert(categories)
    .values(rows)
    .onConflictDoUpdate({
      target: categories.id,
      set: {
        name: sql`excluded.name`,
        color: sql`excluded.color`,
        icon: sql`excluded.icon`,
        position: sql`excluded.position`,
        updatedAt: sql`excluded.updated_at`,
        deletedAt: sql`excluded.deleted_at`,
      },
      setWhere: sql`excluded.updated_at > ${categories.updatedAt} AND ${categories.userId} = ${userId}`,
    });
}
