import type { Database } from '@/db/client';
import { isOnline } from '@/lib/network';
import { setSetting } from '@/repositories/settings';
import { pullFromSupabase } from '@/sync/pull';
import { pushToSupabase, type PushProgress } from '@/sync/push';

// Synchronisation à la demande (bouton « Synchroniser », déconnexion, reconnexion) : push puis pull.
// Verrou minimal : une seule synchronisation à la fois par compte (un appel pendant une
// synchronisation renvoie la même promesse). État exposé par un store sans React (carte Compte).

export const OFFLINE_MESSAGE = 'Pas de connexion internet.';
export const FAILED_MESSAGE = 'La synchronisation a échoué. Réessaie.';

/** État de la synchronisation en cours ou de la dernière tentative (en mémoire uniquement). */
export type SyncRunState = {
  userId: string;
  running: boolean;
  // 0 → 1 : entrées envoyées / total ; le pull, qui suit le push, s'affiche à 1.
  progress: number;
  // Message de la dernière tentative échouée, `null` si elle a réussi.
  error: string | null;
};

export type SyncResult = { ok: true } | { ok: false; reason: 'offline' | 'failed' };

export type SyncOptions = {
  // false : push seul (déconnexion).
  pull?: boolean;
};

/** Dépendances réseau (remplaçables dans les tests). */
export type SyncDeps = {
  isOnline: () => Promise<boolean>;
  push: (db: Database, userId: string, onProgress?: PushProgress) => Promise<void>;
  pull: (db: Database, userId: string) => Promise<void>;
};

const defaultDeps: SyncDeps = { isOnline, push: pushToSupabase, pull: pullFromSupabase };

let state: SyncRunState | null = null;
let running: { userId: string; promise: Promise<SyncResult> } | null = null;
const listeners = new Set<() => void>();

function setState(next: SyncRunState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function subscribeSyncRun(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** État du compte, `null` si aucune synchronisation depuis le lancement. */
export function getSyncRunState(userId: string): SyncRunState | null {
  return state?.userId === userId ? state : null;
}

/** Synchronise le compte (push puis pull). Ne rejette jamais : l'échec est dans le résultat et l'état. */
export function syncNow(
  db: Database,
  userId: string,
  options: SyncOptions = {},
  deps: SyncDeps = defaultDeps,
): Promise<SyncResult> {
  if (running?.userId === userId) return running.promise;
  const promise: Promise<SyncResult> = runSync(db, userId, options, deps).finally(() => {
    if (running?.promise === promise) running = null;
  });
  running = { userId, promise };
  return promise;
}

async function runSync(
  db: Database,
  userId: string,
  { pull = true }: SyncOptions,
  deps: SyncDeps,
): Promise<SyncResult> {
  const update = (patch: Partial<SyncRunState>) => {
    const current = getSyncRunState(userId) ?? { userId, running: false, progress: 0, error: null };
    setState({ ...current, ...patch });
  };

  update({ running: true, progress: 0 });
  // Hors ligne : aucune requête (elle attendrait un délai d'expiration voué à l'échec).
  if (!(await deps.isOnline())) {
    update({ running: false, error: OFFLINE_MESSAGE });
    return { ok: false, reason: 'offline' };
  }

  try {
    await deps.push(db, userId, (sent, total) =>
      update({ progress: total === 0 ? 1 : sent / total }),
    );
    update({ progress: 1 });
    if (pull) await deps.pull(db, userId);
    setSetting(db, userId, 'last_synced_at', new Date().toISOString());
    update({ running: false, error: null });
    return { ok: true };
  } catch (e) {
    console.error('[sync] synchronisation impossible', e);
    update({ running: false, error: FAILED_MESSAGE });
    return { ok: false, reason: 'failed' };
  }
}
