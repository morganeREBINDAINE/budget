import type { SyncStatus } from '@/types/sync';

// Données factices (phase 2) : profil Google et synchro réels en phases 5 et 6.
export const mockProfile = { name: 'Yasmine Benali', email: 'yasmine.benali@gmail.com' };

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

// Les 4 états de la carte de synchro, parcourus en touchant la carte.
export const mockSyncStatuses: SyncStatus[] = [
  { state: 'pending', pendingCount: 3, lastSyncedAt: minutesAgo(60 * 26) },
  { state: 'syncing', progress: 0.6, pendingCount: 3 },
  { state: 'synced', lastSyncedAt: minutesAgo(2) },
  {
    state: 'error',
    message: 'Serveur injoignable. Nouvelle tentative automatique dans 2 min.',
    pendingCount: 3,
    lastSyncedAt: minutesAgo(60 * 26),
  },
];

// Simule une requête asynchrone (export, import, synchro).
export const fakeRequest = (ms = 1200) => new Promise<void>((resolve) => setTimeout(resolve, ms));
