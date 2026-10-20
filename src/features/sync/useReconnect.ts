import { useCallback, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { useAuth, useUserId } from '@/features/auth/AuthProvider';
import { resumeAfterReconnect } from '@/sync/initialPull';

export type Reconnect = {
  // « Se reconnecter avec Google » puis reprise (Promise : spinner et garde du bouton).
  reconnect: () => Promise<void>;
  // Erreur de la dernière reconnexion (ex. autre compte choisi), `null` sinon.
  error: string | null;
};

/**
 * Reconnexion Google du compte local (même user_id uniquement), puis reprise : pull initial s'il
 * n'a pas abouti, sinon synchronisation de la file. Annulation silencieuse.
 */
export function useReconnect(): Reconnect {
  const db = useDatabase();
  const userId = useUserId();
  const { reauthenticate } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const reconnect = useCallback(async () => {
    setError(null);
    const result = await reauthenticate();
    if (result.type === 'error') setError(result.message);
    if (result.type !== 'success') return;
    await resumeAfterReconnect(db, userId);
  }, [db, userId, reauthenticate]);

  return { reconnect, error };
}
