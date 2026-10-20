import type { Database } from '@/db/client';
import { reportError } from '@/lib/errors';
import { saveRemoteRows } from '@/repositories/remoteRows';
import { setSetting } from '@/repositories/settings';
import { insertRow } from '@/repositories/write';
import { pullFromSupabase } from '@/sync/pull';
import { syncNow } from '@/sync/syncNow';
import { createTestDatabase } from '@/test/testDatabase';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/errors', () => ({ reportError: jest.fn() }));
jest.mock('@/sync/pull', () => ({ pullFromSupabase: jest.fn() }));
jest.mock('@/sync/syncNow', () => ({ syncNow: jest.fn() }));
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));

const pull = jest.mocked(pullFromSupabase);
const sync = jest.mocked(syncNow);
const report = jest.mocked(reportError);

// Laisse se terminer les promesses en arrière-plan (envoi de la file après le pull).
const flush = () => new Promise((resolve) => setImmediate(resolve));

const USER = 'user-a';
const OTHER_USER = 'user-b';

const addCategory = (db: Database, userId = USER) =>
  saveRemoteRows(db, userId, 'categories', [
    {
      id: `cat-${userId}`,
      userId,
      name: 'Voiture',
      color: '#EF4444',
      icon: 'car',
      position: 1,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      deletedAt: null,
    },
  ]);

// Store module : rechargé à chaque test pour repartir d'un état vide.
let store: typeof import('@/sync/initialPull');
// Chargée avec le store : `instanceof` ne reconnaît que la classe du même registre de modules.
let SessionError: typeof import('@/sync/session').SessionError;
let db: Database;
let close: () => void;

beforeEach(() => {
  jest.isolateModules(() => {
    store = jest.requireActual<typeof import('@/sync/initialPull')>('@/sync/initialPull');
    ({ SessionError } = jest.requireActual<typeof import('@/sync/session')>('@/sync/session'));
  });
  ({ db, close } = createTestDatabase());
  pull.mockReset();
  sync.mockReset();
  report.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  close();
  jest.restoreAllMocks();
});

describe('startInitialPull', () => {
  it('passe par loading puis ready quand le pull réussit et que les catégories sont là', async () => {
    pull.mockImplementation(async () => addCategory(db));
    const promise = store.startInitialPull(db, USER);
    expect(store.getInitialPullStatus(USER)).toBe('loading');
    await promise;
    expect(store.getInitialPullStatus(USER)).toBe('ready');
  });

  it('passe en erreur si le pull échoue, et un nouvel essai peut réussir', async () => {
    pull.mockRejectedValueOnce(new Error('Réseau coupé'));
    await expect(store.startInitialPull(db, USER)).resolves.toBeUndefined();
    expect(store.getInitialPullStatus(USER)).toBe('error');

    pull.mockImplementation(async () => addCategory(db));
    await store.startInitialPull(db, USER);
    expect(store.getInitialPullStatus(USER)).toBe('ready');
  });

  it('demande une reconnexion si la session est refusée, sans envoyer la file', async () => {
    insertRow(db, 'debt_people', USER, { name: 'Karim' });
    pull.mockRejectedValue(new SessionError('Session absente'));
    await store.startInitialPull(db, USER);
    await flush();
    expect(store.getInitialPullStatus(USER)).toBe('reauth');
    expect(sync).not.toHaveBeenCalled();
  });

  it('passe en erreur si aucune catégorie n’a été récupérée', async () => {
    pull.mockResolvedValue(undefined);
    await store.startInitialPull(db, USER);
    expect(store.getInitialPullStatus(USER)).toBe('error');
  });

  it('ne lance qu’un pull à la fois pour un même compte', async () => {
    pull.mockImplementation(async () => addCategory(db));
    const first = store.startInitialPull(db, USER);
    const second = store.startInitialPull(db, USER);
    expect(second).toBe(first);
    await first;
    expect(pull).toHaveBeenCalledTimes(1);
  });

  it('notifie les abonnés à chaque changement', async () => {
    pull.mockImplementation(async () => addCategory(db));
    const listener = jest.fn();
    const unsubscribe = store.subscribeInitialPull(listener);
    await store.startInitialPull(db, USER);
    unsubscribe();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('ignore le résultat d’un ancien compte après un changement de compte', async () => {
    let finishFirst: () => void = () => undefined;
    pull.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishFirst = resolve;
        }),
    );
    const first = store.startInitialPull(db, OTHER_USER);
    pull.mockImplementationOnce(async () => addCategory(db));
    await store.startInitialPull(db, USER);
    finishFirst();
    await first;
    expect(store.getInitialPullStatus(USER)).toBe('ready');
    expect(store.getInitialPullStatus(OTHER_USER)).toBeNull();
  });
});

describe('envoi de la file après le pull initial', () => {
  const addPending = () => insertRow(db, 'debt_people', USER, { name: 'Karim' });

  it('n’envoie rien si la file est vide', async () => {
    pull.mockImplementation(async () => addCategory(db));
    await store.startInitialPull(db, USER);
    await flush();
    expect(sync).not.toHaveBeenCalled();
  });

  it('envoie la file laissée par une session précédente, en arrière-plan', async () => {
    addPending();
    pull.mockImplementation(async () => addCategory(db));
    sync.mockResolvedValue({ ok: true });
    await store.startInitialPull(db, USER);
    await flush();
    expect(sync).toHaveBeenCalledWith(db, USER);
    expect(report).not.toHaveBeenCalled();
  });

  it('affiche un toast avec le nombre restant si l’envoi échoue', async () => {
    addPending();
    pull.mockImplementation(async () => addCategory(db));
    sync.mockResolvedValue({ ok: false, reason: 'failed' });
    await store.startInitialPull(db, USER);
    await flush();
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Synchronisation impossible : 1 élément en attente.' }),
    );
  });

  it('n’envoie rien si le pull a échoué', async () => {
    addPending();
    pull.mockRejectedValue(new Error('Réseau coupé'));
    await store.startInitialPull(db, USER);
    await flush();
    expect(sync).not.toHaveBeenCalled();
  });
});

describe('resumeInitialPull', () => {
  it('marque prêt un compte déjà récupéré, sans pull', () => {
    setSetting(db, USER, 'last_pulled_at', '2026-10-20T10:00:00+00:00');
    store.resumeInitialPull(db, USER);
    expect(store.getInitialPullStatus(USER)).toBe('ready');
    expect(pull).not.toHaveBeenCalled();
  });

  it('relance le pull d’un compte jamais récupéré', async () => {
    pull.mockImplementation(async () => addCategory(db));
    store.resumeInitialPull(db, USER);
    expect(store.getInitialPullStatus(USER)).toBe('loading');
    expect(pull).toHaveBeenCalledTimes(1);
  });

  it('ne fait rien si le statut du compte est déjà connu', async () => {
    pull.mockRejectedValue(new Error('Réseau coupé'));
    await store.startInitialPull(db, USER);
    store.resumeInitialPull(db, USER);
    expect(pull).toHaveBeenCalledTimes(1);
    expect(store.getInitialPullStatus(USER)).toBe('error');
  });
});

describe('resumeAfterReconnect', () => {
  it('relance le pull initial refusé faute de session, puis le compte est prêt', async () => {
    pull.mockRejectedValueOnce(new SessionError('Session absente'));
    await store.startInitialPull(db, USER);
    pull.mockImplementation(async () => addCategory(db));
    await store.resumeAfterReconnect(db, USER);
    expect(pull).toHaveBeenCalledTimes(2);
    expect(store.getInitialPullStatus(USER)).toBe('ready');
    expect(sync).not.toHaveBeenCalled();
  });

  it('reprend la synchronisation si le compte est déjà récupéré', async () => {
    setSetting(db, USER, 'last_pulled_at', '2026-10-20T10:00:00+00:00');
    store.resumeInitialPull(db, USER);
    sync.mockResolvedValue({ ok: true });
    await store.resumeAfterReconnect(db, USER);
    expect(sync).toHaveBeenCalledWith(db, USER);
    expect(pull).not.toHaveBeenCalled();
  });
});
