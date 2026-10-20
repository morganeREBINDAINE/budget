import type { Database } from '@/db/client';
import { supabase } from '@/lib/supabase';
import { saveRemoteCategories } from '@/repositories/categories';
import { remoteSelect, toLocal, type RemoteRow } from '@/sync/columns';

// Les catégories par défaut sont créées côté Supabase à la création du compte (trigger, migration
// create_default_categories). À chaque connexion Google, on les récupère dans SQLite.

/** Récupère les catégories du compte depuis Supabase et les enregistre en local. */
export async function pullCategories(db: Database, userId: string): Promise<void> {
  // Sans session, la requête partirait en `anon` et serait refusée (42501) : erreur explicite.
  const { data: auth, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Lecture de la session impossible (${sessionError.name})`);
  if (!auth.session) throw new Error('Session absente');
  if (auth.session.user.id !== userId) throw new Error('Session d’un autre compte');

  const { data, error } = await supabase
    .from('categories')
    .select(remoteSelect('categories'))
    .eq('user_id', userId)
    .returns<RemoteRow[]>();
  if (error) throw new Error(`Lecture des catégories impossible (${error.code})`);
  if (data.length === 0) throw new Error('Aucune catégorie trouvée pour ce compte');
  await saveRemoteCategories(
    db,
    userId,
    data.map((remote) => toLocal('categories', remote)),
  );
}
