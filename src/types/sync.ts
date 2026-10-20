// État de la synchronisation avec Supabase (carte de la page Compte).
export type SyncStatus =
  | { state: 'pending'; pendingCount: number; lastSyncedAt: string | null }
  | { state: 'syncing'; progress: number; pendingCount: number }
  | { state: 'synced'; lastSyncedAt: string | null }
  | {
      state: 'error';
      message: string;
      pendingCount: number;
      lastSyncedAt: string | null;
      // Heure ISO de la prochaine relance automatique, `null` si aucune n'est programmée.
      nextRetryAt: string | null;
    };
