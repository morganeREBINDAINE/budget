import { count, eq } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { syncQueue } from '@/db/schema';

/** Requête du nombre d'éléments en attente d'envoi pour un compte (à exécuter ou observer). */
export function pendingSyncCountQuery(db: Database, userId: string) {
  return db.select({ value: count() }).from(syncQueue).where(eq(syncQueue.userId, userId));
}
