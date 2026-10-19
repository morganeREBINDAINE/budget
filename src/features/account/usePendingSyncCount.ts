import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useMemo } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { useUserId } from '@/features/auth/AuthProvider';
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
    if (error) console.error('[sync] lecture de la file d’attente impossible', error);
  }, [error]);

  if (error) return { status: 'error' };
  if (!updatedAt) return { status: 'loading' };
  return { status: 'ready', count: data[0]?.value ?? 0 };
}
