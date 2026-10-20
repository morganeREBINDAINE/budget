import { supabase } from '@/lib/supabase';

/**
 * Vérifie qu'une session Supabase du compte `userId` est disponible avant un appel réseau.
 * Sans session, la requête partirait en `anon` et serait refusée (42501) : erreur explicite.
 */
export async function requireSession(userId: string): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Lecture de la session impossible (${error.name})`);
  if (!data.session) throw new Error('Session absente');
  if (data.session.user.id !== userId) throw new Error('Session d’un autre compte');
}
