import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

/**
 * Vrai si l'état réseau semble en ligne. `null` (état encore inconnu) est traité comme en ligne :
 * seule une absence de réseau avérée évite l'appel, l'échec réseau restant géré par l'appelant.
 */
export function isOnlineState(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>) {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/** Vrai si le téléphone semble en ligne (voir `isOnlineState`). */
export async function isOnline(): Promise<boolean> {
  try {
    return isOnlineState(await NetInfo.fetch());
  } catch (e) {
    console.warn('[network] état du réseau illisible', e);
    return true;
  }
}
