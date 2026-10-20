import type { Database } from '@/db/client';
import { saveRemoteRows } from '@/repositories/remoteRows';
import { setSetting } from '@/repositories/settings';
import { pullFromSupabase } from '@/sync/pull';
import { createTestDatabase } from '@/test/testDatabase';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/sync/pull', () => ({ pullFromSupabase: jest.fn() }));

const pull = jest.mocked(pullFromSupabase);

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
let db: Database;
let close: () => void;

beforeEach(() => {
  jest.isolateModules(() => {
    store = jest.requireActual<typeof import('@/sync/initialPull')>('@/sync/initialPull');
  });
  ({ db, close } = createTestDatabase());
  pull.mockReset();
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
