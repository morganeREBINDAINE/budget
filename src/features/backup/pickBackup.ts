import { File } from 'expo-file-system';

import { parseBackup, type Backup } from '@/backup/format';

/** Taille maximale d'une sauvegarde importée. */
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

// Drive et les gestionnaires de fichiers ne donnent pas toujours `application/json` : le contenu
// est validé de toute façon.
const MIME_TYPES = ['application/json', 'text/plain', 'application/octet-stream'];

export type PickBackupResult =
  { status: 'canceled' } | { status: 'invalid'; error: string } | { status: 'ok'; backup: Backup };

/**
 * Ouvre le sélecteur de fichiers natif puis lit et valide la sauvegarde choisie. Annuler le
 * sélecteur n'est pas une erreur. Rejette si le fichier ne peut pas être lu.
 */
export async function pickBackup(): Promise<PickBackupResult> {
  const picked = await File.pickFileAsync({ mimeTypes: MIME_TYPES });
  if (picked.canceled) return { status: 'canceled' };
  const file = picked.result;
  if (file.size > MAX_BACKUP_BYTES) {
    return { status: 'invalid', error: 'Fichier trop volumineux (20 Mo maximum).' };
  }
  const parsed = parseBackup(await file.text());
  return parsed.ok
    ? { status: 'ok', backup: parsed.backup }
    : { status: 'invalid', error: parsed.error };
}
