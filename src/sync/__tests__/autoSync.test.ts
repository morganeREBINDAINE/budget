import NetInfo, { type NetInfoChangeHandler } from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';

import type { Database } from '@/db/client';
import { isOnline } from '@/lib/network';
import { notifyLocalWrite } from '@/repositories/localWrites';
import { startAutoSync, WRITE_DEBOUNCE_MS } from '@/sync/autoSync';
import { getInitialPullStatus, startInitialPull, type InitialPullStatus } from '@/sync/initialPull';
import { requestSync } from '@/sync/syncNow';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn() },
}));
jest.mock('@/lib/network', () => ({
  ...jest.requireActual<typeof import('@/lib/network')>('@/lib/network'),
  isOnline: jest.fn(),
}));
jest.mock('@/sync/syncNow', () => ({ requestSync: jest.fn() }));
jest.mock('@/sync/initialPull', () => ({
  getInitialPullStatus: jest.fn(),
  startInitialPull: jest.fn(),
}));

const request = jest.mocked(requestSync);
const pullStatus = jest.mocked(getInitialPullStatus);
const initialPull = jest.mocked(startInitialPull);
const online = jest.mocked(isOnline);

const USER = 'user-a';
const OTHER_USER = 'user-b';
const db = {} as Database;

let emitNetwork: NetInfoChangeHandler;
let emitAppState: (state: AppStateStatus) => void;
const stopNetwork = jest.fn();
const stopAppState = jest.fn();

const network = (isConnected: boolean | null, isInternetReachable: boolean | null = null) =>
  emitNetwork({ isConnected, isInternetReachable } as Parameters<NetInfoChangeHandler>[0]);

// Laisse se terminer les promesses lancées par les déclencheurs.
const flush = () => jest.advanceTimersByTimeAsync(0);

// Déclencheurs démarrés par le test, arrêtés après chaque test (abonnement aux écritures partagé).
let running: (() => void)[] = [];

const start = async (status: InitialPullStatus | null = 'ready') => {
  pullStatus.mockReturnValue(status);
  const stop = startAutoSync(db, USER);
  running.push(stop);
  await flush();
  return stop;
};

const triggers = () => request.mock.calls.map(([, , trigger]) => trigger);

beforeEach(() => {
  jest.useFakeTimers();
  request.mockReset().mockResolvedValue(null);
  pullStatus.mockReset();
  initialPull.mockReset().mockResolvedValue(undefined);
  online.mockReset().mockResolvedValue(true);
  stopNetwork.mockReset();
  stopAppState.mockReset();
  jest.mocked(NetInfo.addEventListener).mockImplementation((listener) => {
    emitNetwork = listener;
    return stopNetwork;
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    emitAppState = listener as (state: AppStateStatus) => void;
    return { remove: stopAppState };
  });
});

afterEach(() => {
  running.forEach((stop) => stop());
  running = [];
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('startAutoSync', () => {
  it('démarrage : synchronise le compte déjà récupéré', async () => {
    await start();
    expect(request).toHaveBeenCalledWith(db, USER, 'startup');
  });

  it('pull initial en cours ou en échec : aucune synchro au démarrage', async () => {
    await start('loading');
    await start('error');
    expect(request).not.toHaveBeenCalled();
    expect(initialPull).not.toHaveBeenCalled();
  });

  it('retour du réseau : seulement au passage de hors ligne à en ligne', async () => {
    await start();
    request.mockClear();
    network(true, true); // premier état reçu : pas un retour du réseau
    network(true, null);
    network(false);
    network(true, false); // connecté mais internet injoignable : toujours hors ligne
    expect(request).not.toHaveBeenCalled();
    network(true, true);
    await flush();
    expect(triggers()).toEqual(['network']);
  });

  it('retour au premier plan : seulement depuis l’arrière-plan', async () => {
    await start();
    request.mockClear();
    emitAppState('active');
    expect(request).not.toHaveBeenCalled();
    emitAppState('background');
    emitAppState('active');
    await flush();
    expect(triggers()).toEqual(['foreground']);
  });

  it('écritures du compte regroupées sur le délai, celles d’un autre compte ignorées', async () => {
    await start();
    request.mockClear();
    notifyLocalWrite(USER);
    await jest.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS - 1);
    notifyLocalWrite(USER);
    notifyLocalWrite(OTHER_USER);
    await jest.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS - 1);
    expect(request).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(triggers()).toEqual(['write']);
  });

  it('pull initial en cours : aucun déclencheur ne synchronise', async () => {
    await start('loading');
    network(false);
    network(true);
    emitAppState('background');
    emitAppState('active');
    notifyLocalWrite(USER);
    await jest.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);
    expect(request).not.toHaveBeenCalled();
    expect(initialPull).not.toHaveBeenCalled();
  });

  it('pull initial en échec : relancé au retour du réseau et au premier plan', async () => {
    await start('error');
    network(false);
    network(true);
    await flush();
    expect(initialPull).toHaveBeenCalledTimes(1);
    emitAppState('background');
    emitAppState('active');
    await flush();
    expect(initialPull).toHaveBeenCalledTimes(2);
    expect(initialPull).toHaveBeenCalledWith(db, USER);
    expect(request).not.toHaveBeenCalled();
  });

  it('pull initial en échec : pas relancé au premier plan hors ligne ni après une écriture', async () => {
    await start('error');
    online.mockResolvedValue(false);
    emitAppState('background');
    emitAppState('active');
    notifyLocalWrite(USER);
    await jest.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);
    expect(initialPull).not.toHaveBeenCalled();
  });

  it('session refusée pendant le pull initial : rien n’est relancé avant la reconnexion', async () => {
    await start('reauth');
    network(false);
    network(true);
    emitAppState('background');
    emitAppState('active');
    notifyLocalWrite(USER);
    await jest.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);
    expect(initialPull).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('arrêt : désabonne tout et annule l’envoi des écritures en attente', async () => {
    const stop = await start();
    request.mockClear();
    notifyLocalWrite(USER);
    stop();
    expect(stopNetwork).toHaveBeenCalledTimes(1);
    expect(stopAppState).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);
    notifyLocalWrite(USER);
    await jest.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);
    expect(request).not.toHaveBeenCalled();
  });
});
