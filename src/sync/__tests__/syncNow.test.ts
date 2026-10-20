import type { Database } from '@/db/client';
import { getSetting } from '@/repositories/settings';
import type { SyncDeps } from '@/sync/syncNow';
import { createTestDatabase } from '@/test/testDatabase';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/network', () => ({ isOnline: jest.fn() }));

const USER = 'user-a';
const OTHER_USER = 'user-b';

// Store module : rechargé à chaque test pour repartir d'un état vide.
let store: typeof import('@/sync/syncNow');
let db: Database;
let close: () => void;

const deps = (overrides: Partial<SyncDeps> = {}): SyncDeps => ({
  isOnline: jest.fn(async () => true),
  push: jest.fn(async () => undefined),
  pull: jest.fn(async () => undefined),
  ...overrides,
});

beforeEach(() => {
  jest.isolateModules(() => {
    store = jest.requireActual<typeof import('@/sync/syncNow')>('@/sync/syncNow');
  });
  ({ db, close } = createTestDatabase());
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  close();
  jest.restoreAllMocks();
});

describe('syncNow', () => {
  it('fait push puis pull, enregistre la date de synchro et efface l’erreur', async () => {
    const order: string[] = [];
    const d = deps({
      push: jest.fn(async () => void order.push('push')),
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
    });
  });

  it('push seul avec pull: false', async () => {
    const d = deps();
    await store.syncNow(db, USER, { pull: false }, d);
    expect(d.push).toHaveBeenCalledTimes(1);
    expect(d.pull).not.toHaveBeenCalled();
  });

  it('hors ligne : aucune requête, erreur « Pas de connexion internet. »', async () => {
    const d = deps({ isOnline: jest.fn(async () => false) });
    await expect(store.syncNow(db, USER, {}, d)).resolves.toEqual({
      ok: false,
      reason: 'offline',
    });
    expect(d.push).not.toHaveBeenCalled();
    expect(store.getSyncRunState(USER)).toMatchObject({
      running: false,
      error: store.OFFLINE_MESSAGE,
    });
    expect(getSetting(db, USER, 'last_synced_at')).toBeNull();
  });

  it('échec : ne rejette pas, expose le message et ne date pas la synchro', async () => {
    const d = deps({ pull: jest.fn(async () => Promise.reject(new Error('503'))) });
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
      }),
    });
    await store.syncNow(db, USER, {}, d);
    unsubscribe();
    expect(seen).toEqual([0, 0, 0.5, 1, 1]);
  });

  it('une seule synchronisation à la fois par compte', async () => {
    let release: () => void = () => undefined;
    const d = deps({
      push: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
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
