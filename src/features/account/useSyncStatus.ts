import { and, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { settings } from '@/db/schema';
import { useUserId } from '@/features/auth/AuthProvider';
import { getSyncRunState, subscribeSyncRun, syncNow, type SyncResult } from '@/sync/syncNow';
import type { SyncStatus } from '@/types/sync';

import { usePendingSyncCount } from './usePendingSyncCount';

const COUNT_ERROR_MESSAGE = 'Impossible de lire les éléments en attente.';

/**
 * État de la carte de synchro du compte connecté : synchronisation en cours (store), nombre
 * d'éléments en attente et date de la dernière synchro (requêtes SQLite en direct).
 * `null` tant que le nombre d'éléments en attente n'est pas lu.
 */
export function useSyncStatus(): { status: SyncStatus | null; sync: () => Promise<SyncResult> } {
  const db = useDatabase();
  const userId = useUserId();
  const run = useSyncExternalStore(subscribeSyncRun, () => getSyncRunState(userId));
  const pending = usePendingSyncCount();

  const lastSyncedQuery = useMemo(
    () =>
      db
        .select({ value: settings.value })
        .from(settings)
        .where(and(eq(settings.userId, userId), eq(settings.key, 'last_synced_at'))),
    [db, userId],
  );
  const { data: lastSynced } = useLiveQuery(lastSyncedQuery, [lastSyncedQuery]);
  const lastSyncedAt = lastSynced[0]?.value ?? null;

  const sync = useCallback(() => syncNow(db, userId), [db, userId]);

  let status: SyncStatus | null;
  if (pending.status === 'loading') {
    status = null;
  } else if (pending.status === 'error') {
    status = { state: 'error', message: COUNT_ERROR_MESSAGE, pendingCount: 0, lastSyncedAt };
  } else if (run?.running) {
    status = { state: 'syncing', progress: run.progress, pendingCount: pending.count };
  } else if (run?.error) {
    // Dernière tentative échouée (même file vide : le pull n'a pas pu se faire).
    status = { state: 'error', message: run.error, pendingCount: pending.count, lastSyncedAt };
  } else if (pending.count > 0) {
    status = { state: 'pending', pendingCount: pending.count, lastSyncedAt };
  } else {
    status = { state: 'synced', lastSyncedAt };
  }
  return { status, sync };
}
