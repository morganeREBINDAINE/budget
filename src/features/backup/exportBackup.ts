import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { serializeBackup } from '@/backup/format';
import type { Database } from '@/db/client';
import { toIsoDate } from '@/lib/format';
import { readBackup } from '@/repositories/backup';

/** Le partage de fichiers n'est pas disponible sur l'appareil. */
export class SharingUnavailableError extends Error {
  constructor() {
    super('Partage indisponible');
    this.name = 'SharingUnavailableError';
  }
}

/**
 * Écrit la sauvegarde JSON complète du compte dans le cache (`budget-AAAA-MM-JJ.json`, un export
 * le même jour remplace le précédent) puis ouvre la feuille de partage Android. Fermer la feuille
 * sans choisir de destination n'est pas une erreur.
 */
export async function exportBackup(
  db: Database,
  userId: string,
  accountEmail: string | null,
  now = new Date(),
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new SharingUnavailableError();

  const file = new File(Paths.cache, `budget-${toIsoDate(now)}.json`);
  file.create({ overwrite: true });
  file.write(serializeBackup(readBackup(db, userId, accountEmail, now)));

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Exporter les données',
  });
}
