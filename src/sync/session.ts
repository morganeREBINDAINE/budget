import { isAuthRetryableFetchError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

/** Session absente, illisible ou d'un autre compte : relève de la reconnexion, pas d'un nouvel essai. */
export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

/**
 * Vérifie qu'une session Supabase du compte `userId` est disponible avant un appel réseau.
 * Sans session, la requête partirait en `anon` et serait refusée (42501) : erreur explicite.
 * Un rafraîchissement du token impossible faute de réseau garde la session (supabase-js) : erreur
 * passagère, relancée comme les autres. Un rafraîchissement refusé supprime la session.
 */
export async function requireSession(userId: string): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error && isAuthRetryableFetchError(error)) {
    throw new Error(`Rafraîchissement de la session impossible (${error.name})`);
  }
  if (error) throw new SessionError(`Lecture de la session impossible (${error.name})`);
  if (!data.session) throw new SessionError('Session absente');
  if (data.session.user.id !== userId) throw new SessionError('Session d’un autre compte');
}
