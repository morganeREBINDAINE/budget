import NetInfo from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';

import type { Database } from '@/db/client';
import { isOnline, isOnlineState } from '@/lib/network';
import { subscribeLocalWrites } from '@/repositories/localWrites';
import { getInitialPullStatus, startInitialPull } from '@/sync/initialPull';
import { requestSync, type SyncTrigger } from '@/sync/syncNow';

// Déclencheurs automatiques de la synchronisation du compte connecté (docs/STORAGE.md §3) :
// démarrage de l'app, retour du réseau (NetInfo), retour au premier plan (AppState), après chaque
// écriture locale (regroupées sur un court délai). Les règles (hors ligne, relance programmée,
// intervalle minimal au premier plan) sont appliquées par `requestSync`.
//
// Tant que le pull initial du compte n'a pas réussi, aucune synchronisation : il s'en charge. S'il
// a échoué, le retour du réseau et le retour au premier plan le relancent (si en ligne), sauf si la
// session a été refusée (`reauth`) : rien jusqu'à la reconnexion.

/** Délai de regroupement des écritures avant l'envoi (relancé à chaque nouvelle écriture). */
export const WRITE_DEBOUNCE_MS = 2_000;

/** Démarre les déclencheurs du compte ; renvoie la fonction qui les arrête (déconnexion). */
export function startAutoSync(db: Database, userId: string): () => void {
  const trigger = async (reason: SyncTrigger) => {
    const status = getInitialPullStatus(userId);
    if (status === 'ready') {
      await requestSync(db, userId, reason);
    } else if (status === 'error' && (reason === 'network' || reason === 'foreground')) {
      if (await isOnline()) await startInitialPull(db, userId);
    }
  };

  void trigger('startup');

  // Retour du réseau : passage avéré de hors ligne à en ligne (le premier état reçu n'en est pas un).
  let wasOnline: boolean | null = null;
  const unsubscribeNetwork = NetInfo.addEventListener((state) => {
    const online = isOnlineState(state);
    if (wasOnline === false && online) void trigger('network');
    wasOnline = online;
  });

  let appState: AppStateStatus = AppState.currentState;
  const appStateSubscription = AppState.addEventListener('change', (next) => {
    if ((appState === 'background' || appState === 'inactive') && next === 'active') {
      void trigger('foreground');
    }
    appState = next;
  });

  let writeTimer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribeWrites = subscribeLocalWrites((writerId) => {
    if (writerId !== userId) return;
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
      writeTimer = null;
      void trigger('write');
    }, WRITE_DEBOUNCE_MS);
  });

  return () => {
    unsubscribeNetwork();
    appStateSubscription.remove();
    unsubscribeWrites();
    if (writeTimer) clearTimeout(writeTimer);
  };
}
