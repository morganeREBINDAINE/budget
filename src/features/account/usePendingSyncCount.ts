import { useEffect, useMemo } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { useLiveQuery } from '@/db/useLiveQuery';
import { useUserId } from '@/features/auth/AuthProvider';
import { reportError } from '@/lib/errors';
import { pendingSyncCountQuery } from '@/repositories/syncQueue';

type PendingSyncCount =
  { status: 'loading' } | { status: 'ready'; count: number } | { status: 'error' };

/** Nombre d'éléments de `sync_queue` du compte connecté, mis à jour en direct. */
export function usePendingSyncCount(): PendingSyncCount {
  const db = useDatabase();
  const userId = useUserId();
  const query = useMemo(() => pendingSyncCountQuery(db, userId), [db, userId]);
  const { data, error, updatedAt } = useLiveQuery(query, [query]);

  useEffect(() => {
    if (error) {
      reportError({
        scope: 'sync',
        message: 'Impossible de lire les éléments en attente de synchronisation.',
        error,
      });
    }
  }, [error]);

  if (error) return { status: 'error' };
  if (!updatedAt) return { status: 'loading' };
  return { status: 'ready', count: data[0]?.value ?? 0 };
}
