import { useCallback, useRef, useState } from 'react';

import { summarizeBackup, type Backup, type BackupSummary } from '@/backup/format';
import { useDatabase } from '@/db/DatabaseProvider';
import { useUserId } from '@/features/auth/AuthProvider';
import { useInitialPull } from '@/features/sync/useInitialPull';
import { showToast } from '@/lib/toast';
import { importBackup } from '@/repositories/backup';

import { pickBackup } from './pickBackup';

export type ImportData = {
  /** Choisit et valide le fichier (Promise : spinner de la ligne « Importer »). */
  pickFile: () => Promise<void>;
  /** Fichier choisi et valide, en attente de confirmation (modale ouverte). */
  summary: BackupSummary | null;
  /** Erreur de choix ou de lecture du fichier (affichée dans l'écran). */
  pickError: string | null;
  /** Remplace les données par celles du fichier (Promise : spinner de la modale). */
  confirmImport: () => Promise<void>;
  /** Erreur de l'import (affichée dans la modale). */
  importError: string | null;
  cancel: () => void;
};

// Laisse le spinner s'afficher avant la transaction SQLite, synchrone (bloque le fil JS).
const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 50));

/**
 * Import d'une sauvegarde JSON (page Compte) : choix du fichier, validation, confirmation, puis
 * remplacement de toutes les données du compte. Bloqué tant que le pull initial n'a pas abouti et
 * pendant une opération en cours (garde dans les handlers).
 */
export function useImportData(): ImportData {
  const db = useDatabase();
  const userId = useUserId();
  const { ready } = useInitialPull();
  const inFlight = useRef(false);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const pickFile = useCallback(async () => {
    if (!ready || inFlight.current) return;
    inFlight.current = true;
    setPickError(null);
    try {
      const result = await pickBackup();
      if (result.status === 'invalid') setPickError(result.error);
      if (result.status === 'ok') {
        setImportError(null);
        setBackup(result.backup);
      }
    } catch (e) {
      console.error('[backup] lecture du fichier impossible', e);
      setPickError('Impossible de lire ce fichier.');
    } finally {
      inFlight.current = false;
    }
  }, [ready]);

  const confirmImport = useCallback(async () => {
    if (!ready || inFlight.current || !backup) return;
    inFlight.current = true;
    setImportError(null);
    try {
      await nextFrame();
      importBackup(db, userId, backup);
      setBackup(null);
      showToast({ message: 'Import terminé', variant: 'info' });
    } catch (e) {
      console.error('[backup] import impossible', e);
      setImportError('L’import a échoué. Aucune donnée n’a été modifiée.');
    } finally {
      inFlight.current = false;
    }
  }, [ready, backup, db, userId]);

  const cancel = useCallback(() => {
    if (inFlight.current) return;
    setBackup(null);
    setImportError(null);
  }, []);

  return {
    pickFile,
    summary: backup ? summarizeBackup(backup) : null,
    pickError,
    confirmImport,
    importError,
    cancel,
  };
}
