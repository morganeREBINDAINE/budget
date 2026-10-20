import type { Database } from '@/db/client';
import { reportError } from '@/lib/errors';
import { isOnline } from '@/lib/network';
import { setSetting } from '@/repositories/settings';
import { pullFromSupabase } from '@/sync/pull';
import { pushToSupabase, type PushProgress, type PushResult } from '@/sync/push';
import { SessionError } from '@/sync/session';

// Synchronisation (bouton « Synchroniser », déconnexion, reconnexion) : push puis pull.
// Verrou minimal : une seule synchronisation à la fois par compte (un appel pendant une
// synchronisation renvoie la même promesse). État exposé par un store sans React (carte Compte).
//
// Nouvelles tentatives côté client (docs/STORAGE.md §3 : les données n'existent que sur le
// téléphone) : après un échec passager, relance automatique avec délais croissants, tant que l'app
// est ouverte. Pas de relance hors ligne (le retour du réseau s'en charge) ni si la session est
// refusée (reconnexion requise). Un appel explicite remet le compteur à zéro.

export const OFFLINE_MESSAGE = 'Pas de connexion internet.';
export const FAILED_MESSAGE = 'La synchronisation a échoué. Réessaie.';

/** Délais des relances automatiques successives ; le dernier se répète. */
export const RETRY_DELAYS_MS = [10_000, 30_000, 60_000, 5 * 60_000, 15 * 60_000];

/** État de la synchronisation en cours ou de la dernière tentative (en mémoire uniquement). */
export type SyncRunState = {
  userId: string;
  running: boolean;
  // 0 → 1 : entrées traitées / total ; le pull, qui suit le push, s'affiche à 1.
  progress: number;
  // Message de la dernière tentative échouée, `null` si elle a réussi.
  error: string | null;
  // Heure ISO de la prochaine relance automatique, `null` si aucune n'est programmée.
  nextRetryAt: string | null;
};

export type SyncResult = { ok: true } | { ok: false; reason: 'offline' | 'session' | 'failed' };

export type SyncOptions = {
  // false : push seul (déconnexion).
  pull?: boolean;
};

/** Dépendances réseau (remplaçables dans les tests). */
export type SyncDeps = {
  isOnline: () => Promise<boolean>;
  push: (db: Database, userId: string, onProgress?: PushProgress) => Promise<PushResult>;
  pull: (db: Database, userId: string) => Promise<void>;
};

const defaultDeps: SyncDeps = { isOnline, push: pushToSupabase, pull: pullFromSupabase };

let state: SyncRunState | null = null;
let running: { userId: string; promise: Promise<SyncResult> } | null = null;
// Relances automatiques du compte : rang de la prochaine relance et minuteur programmé.
let retry: { userId: string; step: number; timer: ReturnType<typeof setTimeout> | null } | null =
  null;
const listeners = new Set<() => void>();

function patchState(userId: string, patch: Partial<SyncRunState>) {
  const current = getSyncRunState(userId) ?? {
    userId,
    running: false,
    progress: 0,
    error: null,
    nextRetryAt: null,
  };
  state = { ...current, ...patch };
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

/**
 * Synchronise le compte (push puis pull). Appel explicite : relance programmée annulée et compteur
 * de délais remis à zéro. Ne rejette jamais : l'échec est dans le résultat et l'état.
 */
export function syncNow(
  db: Database,
  userId: string,
  options: SyncOptions = {},
  deps: SyncDeps = defaultDeps,
): Promise<SyncResult> {
  cancelScheduledSync(userId);
  return runLocked(db, userId, options, deps);
}

/** Annule la relance automatique programmée du compte (déconnexion, changement de compte). */
export function cancelScheduledSync(userId: string): void {
  if (retry?.userId === userId) {
    if (retry.timer) clearTimeout(retry.timer);
    retry = null;
  }
  if (getSyncRunState(userId)?.nextRetryAt) patchState(userId, { nextRetryAt: null });
}

function runLocked(
  db: Database,
  userId: string,
  options: SyncOptions,
  deps: SyncDeps,
): Promise<SyncResult> {
  if (running?.userId === userId) return running.promise;
  const promise: Promise<SyncResult> = runSync(db, userId, options, deps).finally(() => {
    if (running?.promise === promise) running = null;
  });
  running = { userId, promise };
  return promise;
}

function scheduleRetry(db: Database, userId: string, deps: SyncDeps) {
  const step = retry?.userId === userId ? retry.step : 0;
  if (retry?.timer) clearTimeout(retry.timer);
  const delay = RETRY_DELAYS_MS[Math.min(step, RETRY_DELAYS_MS.length - 1)];
  const timer = setTimeout(() => {
    if (retry?.timer === timer) retry.timer = null;
    void runLocked(db, userId, {}, deps);
  }, delay);
  retry = { userId, step: step + 1, timer };
  patchState(userId, { nextRetryAt: new Date(Date.now() + delay).toISOString() });
}

function reportRejected(count: number) {
  if (count === 0) return;
  const s = count > 1 ? 's' : '';
  reportError({
    scope: 'sync',
    message: `${count} élément${s} refusé${s} par le serveur. Détails dans Mon compte.`,
    error: `${count} entrée(s) mise(s) de côté`,
    key: 'sync:rejected',
  });
}

async function runSync(
  db: Database,
  userId: string,
  { pull = true }: SyncOptions,
  deps: SyncDeps,
): Promise<SyncResult> {
  patchState(userId, { running: true, progress: 0, nextRetryAt: null });
  // Hors ligne : aucune requête (elle attendrait un délai d'expiration voué à l'échec).
  if (!(await deps.isOnline())) {
    patchState(userId, { running: false, error: OFFLINE_MESSAGE });
    return { ok: false, reason: 'offline' };
  }

  try {
    const pushed = await deps.push(db, userId, (done, total) =>
      patchState(userId, { progress: total === 0 ? 1 : done / total }),
    );
    reportRejected(pushed.rejected);
    patchState(userId, { progress: 1 });
    if (pull) await deps.pull(db, userId);
    setSetting(db, userId, 'last_synced_at', new Date().toISOString());
    if (retry?.userId === userId) retry = null;
    patchState(userId, { running: false, error: null });
    return { ok: true };
  } catch (e) {
    console.error('[sync] synchronisation impossible', e);
    patchState(userId, { running: false, error: FAILED_MESSAGE });
    if (e instanceof SessionError) return { ok: false, reason: 'session' };
    scheduleRetry(db, userId, deps);
    return { ok: false, reason: 'failed' };
  }
}
