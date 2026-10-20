import { and, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { settings } from '@/db/schema';
import { useAuth, useUserId } from '@/features/auth/AuthProvider';
import { useInitialPull } from '@/features/sync/useInitialPull';
import { useReconnect } from '@/features/sync/useReconnect';
import { rejectedSyncCountQuery, requeueRejectedEntries } from '@/repositories/syncQueue';
import { getSyncRunState, subscribeSyncRun, syncNow, type SyncResult } from '@/sync/syncNow';
import type { SyncStatus } from '@/types/sync';

import { usePendingSyncCount } from './usePendingSyncCount';

const COUNT_ERROR_MESSAGE = 'Impossible de lire les éléments en attente.';

const rejectedMessage = (n: number) =>
  n > 1
    ? `${n} éléments refusés par le serveur. Ils restent sur ce téléphone.`
    : '1 élément refusé par le serveur. Il reste sur ce téléphone.';

export type SyncStatusController = {
  // `null` tant que le nombre d'éléments en attente n'est pas lu.
  status: SyncStatus | null;
  sync: () => Promise<SyncResult>;
  // « Se reconnecter avec Google » puis reprise de la file (Promise : spinner et garde du bouton).
  reconnect: () => Promise<void>;
  // Erreur de la dernière reconnexion (sous le bouton), `null` sinon.
  reconnectError: string | null;
};

/**
 * État de la carte de synchro du compte connecté : synchronisation en cours (store), reconnexion
 * requise (session refusée, y compris pendant le pull initial), nombre d'éléments en attente et mis de côté, date de la dernière
 * synchro (requêtes SQLite en direct).
 */
export function useSyncStatus(): SyncStatusController {
  const db = useDatabase();
  const userId = useUserId();
  const { account, needsReauth } = useAuth();
  const run = useSyncExternalStore(subscribeSyncRun, () => getSyncRunState(userId));
  const { status: pullStatus } = useInitialPull();
  const { reconnect, error: reconnectError } = useReconnect();
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

  const rejectedQuery = useMemo(() => rejectedSyncCountQuery(db, userId), [db, userId]);
  const { data: rejected } = useLiveQuery(rejectedQuery, [rejectedQuery]);
  const rejectedCount = rejected[0]?.value ?? 0;

  // « Synchroniser » / « Réessayer » : les éléments mis de côté retentent leur chance.
  const sync = useCallback(() => {
    requeueRejectedEntries(db, userId);
    return syncNow(db, userId);
  }, [db, userId]);

  let status: SyncStatus | null;
  if (pending.status === 'loading') {
    status = null;
  } else if (pending.status === 'error') {
    status = {
      state: 'error',
      message: COUNT_ERROR_MESSAGE,
      pendingCount: 0,
      lastSyncedAt,
      nextRetryAt: null,
    };
  } else if (run?.running) {
    status = { state: 'syncing', progress: run.progress, pendingCount: pending.count };
  } else if (needsReauth || run?.sessionRefused || pullStatus === 'reauth') {
    status = {
      state: 'reauth',
      email: account?.email ?? null,
      pendingCount: pending.count,
      lastSyncedAt,
    };
  } else if (run?.error) {
    // Dernière tentative échouée (même file vide : le pull n'a pas pu se faire).
    status = {
      state: 'error',
      message: run.error,
      pendingCount: pending.count,
      lastSyncedAt,
      nextRetryAt: run.nextRetryAt,
    };
  } else if (rejectedCount > 0) {
    status = {
      state: 'error',
      message: rejectedMessage(rejectedCount),
      pendingCount: pending.count,
      lastSyncedAt,
      nextRetryAt: null,
    };
  } else if (pending.count > 0) {
    status = { state: 'pending', pendingCount: pending.count, lastSyncedAt };
  } else {
    status = { state: 'synced', lastSyncedAt };
  }
  return { status, sync, reconnect, reconnectError };
}
