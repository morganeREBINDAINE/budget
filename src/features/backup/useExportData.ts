import { useCallback, useRef, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { useAuth, useUserId } from '@/features/auth/AuthProvider';
import { useInitialPull } from '@/features/sync/useInitialPull';
import { reportError } from '@/lib/errors';

import { exportBackup, SharingUnavailableError } from './exportBackup';

type ErrorDisplay = 'toast' | 'inline';

export type ExportData = {
  /** Lance l'export (Promise : spinner automatique des `ListItem` / `Button`). */
  exportData: () => Promise<void>;
  exporting: boolean;
  /** Dernière erreur, renseignée seulement en affichage `inline`. */
  error: string | null;
};

function errorMessage(e: unknown): string {
  return e instanceof SharingUnavailableError
    ? 'Le partage n’est pas disponible sur cet appareil.'
    : 'L’export a échoué. Réessaie.';
}

/**
 * Export de la sauvegarde JSON (barre haute des écrans principaux, page Compte). Bloqué tant que
 * le pull initial n'a pas abouti et pendant un export en cours (garde dans le handler). Erreur en
 * toast, ou exposée dans `error` pour l'afficher dans l'écran.
 */
export function useExportData({ errorDisplay }: { errorDisplay: ErrorDisplay }): ExportData {
  const db = useDatabase();
  const userId = useUserId();
  const { account } = useAuth();
  const { ready } = useInitialPull();
  const inFlight = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = account?.email ?? null;

  const exportData = useCallback(async () => {
    if (!ready || inFlight.current) return;
    inFlight.current = true;
    setExporting(true);
    setError(null);
    try {
      await exportBackup(db, userId, email);
    } catch (e) {
      const message = errorMessage(e);
      if (errorDisplay === 'toast') {
        reportError({ scope: 'backup', message, error: e });
      } else {
        console.error(`[backup] ${message}`, e);
        setError(message);
      }
    } finally {
      inFlight.current = false;
      setExporting(false);
    }
  }, [ready, db, userId, email, errorDisplay]);

  return { exportData, exporting, error };
}
