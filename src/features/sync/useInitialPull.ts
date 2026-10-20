import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { useUserId } from '@/features/auth/AuthProvider';
import {
  getInitialPullStatus,
  hasPulledOnce,
  startInitialPull,
  subscribeInitialPull,
  type InitialPullStatus,
} from '@/sync/initialPull';

export type InitialPull = {
  status: InitialPullStatus;
  // Données du compte disponibles : à vérifier dans les handlers des actions qui en dépendent.
  ready: boolean;
  // Relance le pull (Promise : spinner et garde du bouton « Réessayer »).
  retry: () => Promise<void>;
};

/** État du pull initial du compte connecté (skeletons, bloc d'erreur, garde des actions). */
export function useInitialPull(): InitialPull {
  const db = useDatabase();
  const userId = useUserId();
  const known = useSyncExternalStore(subscribeInitialPull, () => getInitialPullStatus(userId));
  // Avant l'évaluation au démarrage (resumeInitialPull) : déduit du dernier pull, sans flash.
  const fallback = useMemo<InitialPullStatus>(
    () => (hasPulledOnce(db, userId) ? 'ready' : 'loading'),
    [db, userId],
  );
  const status = known ?? fallback;
  const retry = useCallback(() => startInitialPull(db, userId), [db, userId]);
  return { status, ready: status === 'ready', retry };
}
