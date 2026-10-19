import type { Database } from '@/db/client';
import type { NewCategoryRow } from '@/db/schema';
import { supabase } from '@/lib/supabase';
import { saveRemoteCategories } from '@/repositories/categories';

// Les catégories par défaut sont créées côté Supabase à la création du compte (trigger, migration
// create_default_categories). À chaque connexion Google, on les récupère dans SQLite.

type RemoteCategory = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const COLUMNS = 'id, user_id, name, color, icon, position, created_at, updated_at, deleted_at';

// Horodatages Postgres (`+00:00`, microsecondes) → ISO 8601 du client, comparable en texte.
const toIso = (value: string) => new Date(value).toISOString();

function toRow(remote: RemoteCategory): NewCategoryRow {
  return {
    id: remote.id,
    userId: remote.user_id,
    name: remote.name,
    color: remote.color,
    icon: remote.icon,
    position: remote.position,
    createdAt: toIso(remote.created_at),
    updatedAt: toIso(remote.updated_at),
    deletedAt: remote.deleted_at === null ? null : toIso(remote.deleted_at),
  };
}

/** Récupère les catégories du compte depuis Supabase et les enregistre en local. */
export async function pullCategories(db: Database, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('categories')
    .select(COLUMNS)
    .eq('user_id', userId)
    .returns<RemoteCategory[]>();
  if (error) throw new Error(`Lecture des catégories impossible (${error.code})`);
  if (data.length === 0) throw new Error('Aucune catégorie trouvée pour ce compte');
  await saveRemoteCategories(db, userId, data.map(toRow));
}
