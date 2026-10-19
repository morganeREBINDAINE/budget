import NetInfo from '@react-native-community/netinfo';

/**
 * Vrai si le téléphone semble en ligne. `null` (état encore inconnu) est traité comme en ligne :
 * seule une absence de réseau avérée évite l'appel, l'échec réseau restant géré par l'appelant.
 */
export async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected !== false && state.isInternetReachable !== false;
  } catch (e) {
    console.warn('[network] état du réseau illisible', e);
    return true;
  }
}
