import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import type { Database } from '@/db/client';
import type { LocalAccount } from '@/features/auth/localAccount';
import {
  BACKGROUND_SYNC_INTERVAL_MINUTES,
  BACKGROUND_SYNC_TASK,
  registerBackgroundSync,
  runBackgroundSync,
  unregisterBackgroundSync,
  type BackgroundSyncDeps,
} from '@/features/sync/backgroundSync';
import { getInitialPullStatus, hasPulledOnce } from '@/sync/initialPull';
import { requestSync } from '@/sync/syncNow';

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(),
}));
jest.mock('expo-background-task', () => ({
  BackgroundTaskStatus: { Restricted: 1, Available: 2 },
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  getStatusAsync: jest.fn(),
  registerTaskAsync: jest.fn(),
  unregisterTaskAsync: jest.fn(),
}));
jest.mock('@/db/client', () => ({ prepareDatabase: jest.fn() }));
jest.mock('@/db/migrate', () => ({ runMigrations: jest.fn() }));
jest.mock('@/features/auth/localAccount', () => ({ loadLocalAccount: jest.fn() }));
jest.mock('@/sync/initialPull', () => ({
  getInitialPullStatus: jest.fn(),
  hasPulledOnce: jest.fn(),
}));
jest.mock('@/sync/syncNow', () => ({ requestSync: jest.fn() }));

const pullStatus = jest.mocked(getInitialPullStatus);
const pulledOnce = jest.mocked(hasPulledOnce);
const status = jest.mocked(BackgroundTask.getStatusAsync);
const register = jest.mocked(BackgroundTask.registerTaskAsync);
const unregister = jest.mocked(BackgroundTask.unregisterTaskAsync);
const isRegistered = jest.mocked(TaskManager.isTaskRegisteredAsync);

// Appel de defineTask au chargement du module, relevé avant que les mocks soient remis à zéro.
const [definedName, definedExecutor] = jest.mocked(TaskManager.defineTask).mock.calls[0];

const USER = 'user-a';
const ACCOUNT: LocalAccount = { id: USER, email: 'a@example.com', name: 'A' };
const db = {} as Database;

const deps = (overrides: Partial<BackgroundSyncDeps> = {}): BackgroundSyncDeps => ({
  openDatabase: jest.fn(async () => db),
  loadAccount: jest.fn(async () => ACCOUNT),
  sync: jest.fn(async () => ({ ok: true as const })),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  pullStatus.mockReturnValue(null);
  pulledOnce.mockReturnValue(true);
  status.mockResolvedValue(BackgroundTask.BackgroundTaskStatus.Available);
  isRegistered.mockResolvedValue(false);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('runBackgroundSync', () => {
  it('synchronise le compte local déjà récupéré', async () => {
    const d = deps();
    await expect(runBackgroundSync(d)).resolves.toBe('synced');
    expect(pulledOnce).toHaveBeenCalledWith(db, USER);
    expect(d.sync).toHaveBeenCalledWith(db, USER);
  });

  it('sans compte local : rien', async () => {
    const d = deps({ loadAccount: jest.fn(async () => null) });
    await expect(runBackgroundSync(d)).resolves.toBe('signedOut');
    expect(d.sync).not.toHaveBeenCalled();
  });

  it('compte jamais récupéré : rien (le pull initial s’en charge)', async () => {
    pulledOnce.mockReturnValue(false);
    const d = deps();
    await expect(runBackgroundSync(d)).resolves.toBe('notPulled');
    expect(d.sync).not.toHaveBeenCalled();
  });

  it.each(['loading', 'error', 'reauth'] as const)(
    'pull initial « %s » dans cette session : rien',
    async (initial) => {
      pullStatus.mockReturnValue(initial);
      const d = deps();
      await expect(runBackgroundSync(d)).resolves.toBe('notPulled');
      expect(d.sync).not.toHaveBeenCalled();
    },
  );

  it('pull initial réussi dans cette session : synchronise', async () => {
    pullStatus.mockReturnValue('ready');
    pulledOnce.mockReturnValue(false);
    await expect(runBackgroundSync(deps())).resolves.toBe('synced');
  });

  it('hors ligne ou session refusée : ignoré', async () => {
    for (const result of [
      null,
      { ok: false as const, reason: 'offline' as const },
      { ok: false as const, reason: 'session' as const },
    ]) {
      await expect(runBackgroundSync(deps({ sync: jest.fn(async () => result) }))).resolves.toBe(
        'skipped',
      );
    }
  });

  it('échec de la synchro : failed', async () => {
    const d = deps({
      sync: jest.fn(async () => ({ ok: false as const, reason: 'failed' as const })),
    });
    await expect(runBackgroundSync(d)).resolves.toBe('failed');
  });

  it('base ou compte illisibles : failed, sans rejeter', async () => {
    const noDb = deps({
      openDatabase: jest.fn(async () => Promise.reject(new Error('migration'))),
    });
    await expect(runBackgroundSync(noDb)).resolves.toBe('failed');
    expect(noDb.sync).not.toHaveBeenCalled();

    const noAccount = deps({
      loadAccount: jest.fn(async () => Promise.reject(new Error('keystore'))),
    });
    await expect(runBackgroundSync(noAccount)).resolves.toBe('failed');
  });

  it('tâche définie au chargement, déclencheur « background » par défaut', async () => {
    expect(definedName).toBe(BACKGROUND_SYNC_TASK);

    const { prepareDatabase } = jest.requireMock<typeof import('@/db/client')>('@/db/client');
    const { loadLocalAccount } = jest.requireMock<typeof import('@/features/auth/localAccount')>(
      '@/features/auth/localAccount',
    );
    jest
      .mocked(prepareDatabase)
      .mockResolvedValue({ db } as Awaited<ReturnType<typeof prepareDatabase>>);
    jest.mocked(loadLocalAccount).mockResolvedValue(ACCOUNT);
    jest.mocked(requestSync).mockResolvedValue({ ok: false, reason: 'failed' });

    const run = definedExecutor as unknown as () => Promise<BackgroundTask.BackgroundTaskResult>;
    await expect(run()).resolves.toBe(BackgroundTask.BackgroundTaskResult.Failed);
    expect(requestSync).toHaveBeenCalledWith(db, USER, 'background');

    jest.mocked(requestSync).mockResolvedValue({ ok: true });
    await expect(run()).resolves.toBe(BackgroundTask.BackgroundTaskResult.Success);
  });
});

describe('enregistrement', () => {
  it('enregistre la tâche avec l’intervalle de 15 min', async () => {
    await registerBackgroundSync();
    expect(register).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK, {
      minimumInterval: BACKGROUND_SYNC_INTERVAL_MINUTES,
    });
    expect(BACKGROUND_SYNC_INTERVAL_MINUTES).toBe(15);
  });

  it('déjà enregistrée : rien', async () => {
    isRegistered.mockResolvedValue(true);
    await registerBackgroundSync();
    expect(register).not.toHaveBeenCalled();
  });

  it('tâches de fond indisponibles : rien', async () => {
    status.mockResolvedValue(BackgroundTask.BackgroundTaskStatus.Restricted);
    await registerBackgroundSync();
    expect(register).not.toHaveBeenCalled();
  });

  it('échec de l’enregistrement ou du retrait : journalisé, sans rejeter', async () => {
    register.mockRejectedValueOnce(new Error('natif'));
    await expect(registerBackgroundSync()).resolves.toBeUndefined();
    unregister.mockRejectedValueOnce(new Error('natif'));
    await expect(unregisterBackgroundSync()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it('retire la tâche à la déconnexion, après un enregistrement en cours', async () => {
    const order: string[] = [];
    register.mockImplementation(async () => void order.push('register'));
    unregister.mockImplementation(async () => void order.push('unregister'));
    void registerBackgroundSync();
    await unregisterBackgroundSync();
    expect(order).toEqual(['register', 'unregister']);
  });
});
