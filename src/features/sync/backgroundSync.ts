import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { prepareDatabase, type Database } from '@/db/client';
import { runMigrations } from '@/db/migrate';
import { loadLocalAccount, type LocalAccount } from '@/features/auth/localAccount';
import { getInitialPullStatus, hasPulledOnce } from '@/sync/initialPull';
import { requestSync, type SyncResult } from '@/sync/syncNow';

// Synchronisation app fermée ou en arrière-plan (docs/STORAGE.md §3) : tâche WorkManager exécutée
// par Android au plus toutes les 15 min, réseau disponible, jamais app au premier plan. Android
// peut relancer l'app sans écran : la tâche est définie au chargement du bundle (index.ts), ouvre
// la base elle-même et lit le compte local, sans dépendre de l'état React.
//
// À chaque exécution : push puis pull du compte local, s'il a déjà été récupéré au moins une fois
// (sinon le pull initial, app ouverte, s'en charge). Règles du déclencheur `background` dans
// `requestSync` : silencieux hors ligne, rien si la session est refusée, ni relance ni toast.
// Enregistrée à l'ouverture de l'app connectée, retirée à la déconnexion manuelle.

export const BACKGROUND_SYNC_TASK = 'budget-background-sync';

/** Intervalle minimum demandé à Android (minutes) ; Android décide de l'heure réelle. */
export const BACKGROUND_SYNC_INTERVAL_MINUTES = 15;

/** Issue d'une exécution (journal et tests). */
export type BackgroundSyncOutcome =
  // Aucun compte local (déconnecté).
  | 'signedOut'
  // Compte jamais récupéré, ou pull initial en cours ou en échec dans cette session.
  | 'notPulled'
  // Rien à faire : hors ligne ou session refusée.
  | 'skipped'
  | 'synced'
  | 'failed';

/** Dépendances (remplaçables dans les tests). */
export type BackgroundSyncDeps = {
  openDatabase: () => Promise<Database>;
  loadAccount: () => Promise<LocalAccount | null>;
  sync: (db: Database, userId: string) => Promise<SyncResult | null>;
};

const defaultDeps: BackgroundSyncDeps = {
  openDatabase: async () => (await prepareDatabase(runMigrations)).db,
  loadAccount: loadLocalAccount,
  sync: (db, userId) => requestSync(db, userId, 'background'),
};

/** Une exécution de la tâche. Ne rejette jamais. */
export async function runBackgroundSync(
  deps: BackgroundSyncDeps = defaultDeps,
): Promise<BackgroundSyncOutcome> {
  try {
    const db = await deps.openDatabase();
    const account = await deps.loadAccount();
    if (!account) return 'signedOut';

    const pullStatus = getInitialPullStatus(account.id);
    const pulled = pullStatus ? pullStatus === 'ready' : hasPulledOnce(db, account.id);
    if (!pulled) return 'notPulled';

    const result = await deps.sync(db, account.id);
    if (!result || (!result.ok && result.reason !== 'failed')) return 'skipped';
    return result.ok ? 'synced' : 'failed';
  } catch (e) {
    console.error('[sync] tâche de fond impossible', e);
    return 'failed';
  }
}

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  const outcome = await runBackgroundSync();
  console.log(`[sync] tâche de fond : ${outcome}`);
  return outcome === 'failed'
    ? BackgroundTask.BackgroundTaskResult.Failed
    : BackgroundTask.BackgroundTaskResult.Success;
});

// Enregistrements et retraits exécutés l'un après l'autre (vérification puis appel natif).
let pending: Promise<void> = Promise.resolve();

function enqueue(operation: () => Promise<void>): Promise<void> {
  pending = pending.then(operation, operation);
  return pending;
}

/**
 * Enregistre la tâche si elle ne l'est pas déjà (l'enregistrement persiste entre les lancements).
 * Échec journalisé seulement : la synchro app ouverte continue. Ne rejette jamais.
 */
export function registerBackgroundSync(): Promise<void> {
  return enqueue(async () => {
    try {
      const status = await BackgroundTask.getStatusAsync();
      if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
        console.warn('[sync] tâches de fond indisponibles sur ce téléphone');
        return;
      }
      if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)) return;
      await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: BACKGROUND_SYNC_INTERVAL_MINUTES,
      });
    } catch (e) {
      console.error('[sync] enregistrement de la tâche de fond impossible', e);
    }
  });
}

/** Retire la tâche (déconnexion manuelle). Échec journalisé seulement. Ne rejette jamais. */
export function unregisterBackgroundSync(): Promise<void> {
  return enqueue(async () => {
    try {
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    } catch (e) {
      console.error('[sync] retrait de la tâche de fond impossible', e);
    }
  });
}
