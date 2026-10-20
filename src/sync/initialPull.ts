import type { Database } from '@/db/client';
import { reportError } from '@/lib/errors';
import { hasLocalCategories } from '@/repositories/remoteRows';
import { getSetting } from '@/repositories/settings';
import { pendingSyncCount } from '@/repositories/syncQueue';
import { pullFromSupabase } from '@/sync/pull';
import { syncNow } from '@/sync/syncNow';

// Pull initial d'un compte (store sans React) : lancé à chaque connexion Google, et au démarrage
// tant que le compte n'a jamais été récupéré (`last_pulled_at` absent, ex. échec puis app fermée).
// Pendant le pull, les écrans affichent des skeletons ; en cas d'échec, un bloc d'erreur
// « Réessayer » ; les actions qui dépendent des données sont bloquées. Une fois les données
// récupérées, les éléments laissés en file par une session précédente du compte partent en
// arrière-plan (docs/STORAGE.md §4).

export type InitialPullStatus = 'loading' | 'error' | 'ready';

type State = { userId: string; status: InitialPullStatus } | null;

let state: State = null;
let running: { userId: string; promise: Promise<void> } | null = null;
const listeners = new Set<() => void>();

function setState(next: State) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function subscribeInitialPull(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Statut connu du compte, `null` s'il n'a pas encore été évalué depuis le lancement. */
export function getInitialPullStatus(userId: string): InitialPullStatus | null {
  return state?.userId === userId ? state.status : null;
}

/** Le compte a déjà été récupéré au moins une fois sur ce téléphone. */
export function hasPulledOnce(db: Database, userId: string): boolean {
  return getSetting(db, userId, 'last_pulled_at') !== null;
}

/**
 * Lance le pull du compte (un seul à la fois par compte : un appel pendant le pull renvoie la même
 * promesse). Ne rejette jamais : l'échec est exposé par le statut `error`.
 */
export function startInitialPull(db: Database, userId: string): Promise<void> {
  if (running?.userId === userId) return running.promise;
  setState({ userId, status: 'loading' });
  const promise: Promise<void> = runInitialPull(db, userId).finally(() => {
    if (running?.promise === promise) running = null;
  });
  running = { userId, promise };
  return promise;
}

async function runInitialPull(db: Database, userId: string): Promise<void> {
  try {
    await pullFromSupabase(db, userId);
    // Les catégories sont créées par Supabase à la création du compte : sans elles, pas de dépense.
    if (!hasLocalCategories(db, userId)) throw new Error('Aucune catégorie trouvée pour ce compte');
    if (state?.userId === userId) setState({ userId, status: 'ready' });
  } catch (e) {
    console.error('[sync] pull initial impossible', e);
    if (state?.userId === userId) setState({ userId, status: 'error' });
    return;
  }
  if (pendingSyncCount(db, userId) > 0) void pushPendingInBackground(db, userId);
}

async function pushPendingInBackground(db: Database, userId: string): Promise<void> {
  const result = await syncNow(db, userId);
  if (result.ok) return;
  const n = pendingSyncCount(db, userId);
  reportError({
    scope: 'sync',
    message: `Synchronisation impossible : ${n} élément${n > 1 ? 's' : ''} en attente.`,
    error: result.reason,
    key: 'sync:background',
  });
}

/** Au démarrage : relance le pull d'un compte jamais récupéré, sinon le marque prêt. */
export function resumeInitialPull(db: Database, userId: string): void {
  if (getInitialPullStatus(userId) !== null) return;
  if (hasPulledOnce(db, userId)) setState({ userId, status: 'ready' });
  else void startInitialPull(db, userId);
}
