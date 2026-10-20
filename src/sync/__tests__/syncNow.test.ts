import type { Database } from '@/db/client';
import { reportError } from '@/lib/errors';
import { getSetting } from '@/repositories/settings';
import type { PushResult } from '@/sync/push';
import type { SyncDeps } from '@/sync/syncNow';
import { createTestDatabase } from '@/test/testDatabase';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/network', () => ({ isOnline: jest.fn() }));
jest.mock('@/lib/errors', () => ({ reportError: jest.fn() }));

const report = jest.mocked(reportError);

const USER = 'user-a';
const OTHER_USER = 'user-b';
const NOTHING: PushResult = { sent: 0, rejected: 0 };

// Store module : rechargé à chaque test pour repartir d'un état vide.
let store: typeof import('@/sync/syncNow');
// Classe du même registre de modules que le store (instanceof).
let SessionError: typeof import('@/sync/session').SessionError;
let db: Database;
let close: () => void;

const deps = (overrides: Partial<SyncDeps> = {}): SyncDeps => ({
  isOnline: jest.fn(async () => true),
  push: jest.fn(async () => NOTHING),
  pull: jest.fn(async () => undefined),
  ...overrides,
});

const failingPull = () => jest.fn(async () => Promise.reject(new Error('503')));

beforeEach(() => {
  jest.isolateModules(() => {
    store = jest.requireActual<typeof import('@/sync/syncNow')>('@/sync/syncNow');
    ({ SessionError } = jest.requireActual<typeof import('@/sync/session')>('@/sync/session'));
  });
  ({ db, close } = createTestDatabase());
  report.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  close();
  jest.restoreAllMocks();
});

describe('syncNow', () => {
  it('fait push puis pull, enregistre la date de synchro et efface l’erreur', async () => {
    const order: string[] = [];
    const d = deps({
      push: jest.fn(async () => {
        order.push('push');
        return NOTHING;
      }),
      pull: jest.fn(async () => void order.push('pull')),
    });
    await expect(store.syncNow(db, USER, {}, d)).resolves.toEqual({ ok: true });
    expect(order).toEqual(['push', 'pull']);
    expect(getSetting(db, USER, 'last_synced_at')).not.toBeNull();
    expect(store.getSyncRunState(USER)).toEqual({
      userId: USER,
      running: false,
      progress: 1,
      error: null,
      nextRetryAt: null,
    });
  });

  it('push seul avec pull: false', async () => {
    const d = deps();
    await store.syncNow(db, USER, { pull: false }, d);
    expect(d.push).toHaveBeenCalledTimes(1);
    expect(d.pull).not.toHaveBeenCalled();
  });

  it('hors ligne : aucune requête, erreur « Pas de connexion internet. », pas de relance', async () => {
    jest.useFakeTimers();
    const d = deps({ isOnline: jest.fn(async () => false) });
    await expect(store.syncNow(db, USER, {}, d)).resolves.toEqual({
      ok: false,
      reason: 'offline',
    });
    expect(d.push).not.toHaveBeenCalled();
    expect(store.getSyncRunState(USER)).toMatchObject({
      running: false,
      error: store.OFFLINE_MESSAGE,
      nextRetryAt: null,
    });
    expect(getSetting(db, USER, 'last_synced_at')).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('échec : ne rejette pas, expose le message et ne date pas la synchro', async () => {
    jest.useFakeTimers();
    const d = deps({ pull: failingPull() });
    await expect(store.syncNow(db, USER, {}, d)).resolves.toEqual({
      ok: false,
      reason: 'failed',
    });
    expect(store.getSyncRunState(USER)).toMatchObject({
      running: false,
      error: store.FAILED_MESSAGE,
    });
    expect(getSetting(db, USER, 'last_synced_at')).toBeNull();
  });

  it('expose l’avancement du push pendant la synchro', async () => {
    const seen: number[] = [];
    const unsubscribe = store.subscribeSyncRun(() => {
      const state = store.getSyncRunState(USER);
      if (state?.running) seen.push(state.progress);
    });
    const d = deps({
      push: jest.fn(async (_db, _user, onProgress) => {
        onProgress?.(0, 4);
        onProgress?.(2, 4);
        onProgress?.(4, 4);
        return { sent: 4, rejected: 0 };
      }),
    });
    await store.syncNow(db, USER, {}, d);
    unsubscribe();
    expect(seen).toEqual([0, 0, 0.5, 1, 1]);
  });

  it('signale par un toast les éléments mis de côté, sans échouer', async () => {
    const d = deps({ push: jest.fn(async () => ({ sent: 3, rejected: 2 })) });
    await expect(store.syncNow(db, USER, {}, d)).resolves.toEqual({ ok: true });
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '2 éléments refusés par le serveur. Détails dans Mon compte.',
      }),
    );
  });

  it('une seule synchronisation à la fois par compte', async () => {
    let release: () => void = () => undefined;
    const d = deps({
      push: jest.fn(
        () =>
          new Promise<PushResult>((resolve) => {
            release = () => resolve(NOTHING);
          }),
      ),
    });
    const first = store.syncNow(db, USER, {}, d);
    const second = store.syncNow(db, USER, { pull: false }, d);
    expect(second).toBe(first);
    // Laisse passer la vérification du réseau, puis termine le push.
    await new Promise((resolve) => setImmediate(resolve));
    release();
    await first;
    expect(d.push).toHaveBeenCalledTimes(1);

    // Terminée : un nouvel appel relance une synchronisation.
    await store.syncNow(db, USER, {}, deps());
    expect(store.getSyncRunState(USER)?.running).toBe(false);
  });

  it('sépare l’état de chaque compte', async () => {
    await store.syncNow(db, USER, {}, deps());
    expect(store.getSyncRunState(OTHER_USER)).toBeNull();
  });
});

describe('relances automatiques', () => {
  const NOW = new Date('2026-10-20T14:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });

  it('relance après un échec avec des délais croissants, le dernier se répétant', async () => {
    const d = deps({ pull: failingPull() });
    await store.syncNow(db, USER, {}, d);

    const last = store.RETRY_DELAYS_MS[store.RETRY_DELAYS_MS.length - 1];
    const delays = [...store.RETRY_DELAYS_MS, last];
    for (const [i, delay] of delays.entries()) {
      const expectedAt = new Date(Date.now() + delay).toISOString();
      expect(store.getSyncRunState(USER)?.nextRetryAt).toBe(expectedAt);
      await jest.advanceTimersByTimeAsync(delay - 1);
      expect(d.pull).toHaveBeenCalledTimes(i + 1);
      await jest.advanceTimersByTimeAsync(1);
      expect(d.pull).toHaveBeenCalledTimes(i + 2);
    }
  });

  it('s’arrête et remet le compteur à zéro après un succès', async () => {
    const pull = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(new Error('503'));
    const d = deps({ pull });
    await store.syncNow(db, USER, {}, d);
    await jest.advanceTimersByTimeAsync(store.RETRY_DELAYS_MS[0]);
    expect(pull).toHaveBeenCalledTimes(2);
    expect(store.getSyncRunState(USER)).toMatchObject({ error: null, nextRetryAt: null });
    expect(jest.getTimerCount()).toBe(0);

    // Nouvel échec plus tard : on repart du premier délai.
    await store.syncNow(db, USER, {}, d);
    expect(store.getSyncRunState(USER)?.nextRetryAt).toBe(
      new Date(Date.now() + store.RETRY_DELAYS_MS[0]).toISOString(),
    );
  });

  it('un appel explicite annule la relance programmée et repart du premier délai', async () => {
    const d = deps({ pull: failingPull() });
    await store.syncNow(db, USER, {}, d);
    await jest.advanceTimersByTimeAsync(store.RETRY_DELAYS_MS[0]);
    // Deuxième échec : relance programmée au deuxième délai.
    expect(store.getSyncRunState(USER)?.nextRetryAt).toBe(
      new Date(Date.now() + store.RETRY_DELAYS_MS[1]).toISOString(),
    );

    await store.syncNow(db, USER, {}, d);
    expect(store.getSyncRunState(USER)?.nextRetryAt).toBe(
      new Date(Date.now() + store.RETRY_DELAYS_MS[0]).toISOString(),
    );
    expect(jest.getTimerCount()).toBe(1);
  });

  it('pas de relance si la session est refusée', async () => {
    const d = deps({
      push: jest.fn(async () => Promise.reject(new SessionError('Session absente'))),
    });
    await expect(store.syncNow(db, USER, {}, d)).resolves.toEqual({
      ok: false,
      reason: 'session',
    });
    expect(store.getSyncRunState(USER)?.nextRetryAt).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cancelScheduledSync annule la relance du compte', async () => {
    const d = deps({ pull: failingPull() });
    await store.syncNow(db, USER, {}, d);
    store.cancelScheduledSync(USER);
    expect(store.getSyncRunState(USER)?.nextRetryAt).toBeNull();
    await jest.advanceTimersByTimeAsync(store.RETRY_DELAYS_MS[0] * 2);
    expect(d.pull).toHaveBeenCalledTimes(1);
  });

  it('cancelScheduledSync d’un autre compte ne touche pas à la relance', async () => {
    const d = deps({ pull: failingPull() });
    await store.syncNow(db, USER, {}, d);
    store.cancelScheduledSync(OTHER_USER);
    await jest.advanceTimersByTimeAsync(store.RETRY_DELAYS_MS[0]);
    expect(d.pull).toHaveBeenCalledTimes(2);
  });
});
