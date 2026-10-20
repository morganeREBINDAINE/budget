import { and, count, eq, inArray, sql } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { syncQueue, type SyncQueueRow } from '@/db/schema';

/** Requête du nombre d'éléments en attente d'envoi pour un compte (à exécuter ou observer). */
export function pendingSyncCountQuery(db: Database, userId: string) {
  return db.select({ value: count() }).from(syncQueue).where(eq(syncQueue.userId, userId));
}

/** Nombre d'éléments en attente d'envoi pour un compte. */
export function pendingSyncCount(db: Database, userId: string): number {
  return pendingSyncCountQuery(db, userId).get()?.value ?? 0;
}

/** Plus anciennes entrées du compte, dans l'ordre d'écriture (`rowid` : ordre d'insertion). */
export function readQueueBatch(db: Database, userId: string, limit: number): SyncQueueRow[] {
  return db
    .select()
    .from(syncQueue)
    .where(eq(syncQueue.userId, userId))
    .orderBy(sql`rowid`)
    .limit(limit)
    .all();
}

/** Retire des entrées envoyées (par id d'entrée : une écriture faite pendant l'envoi reste en file). */
export function removeQueueEntries(db: Database, userId: string, ids: string[]): void {
  if (ids.length === 0) return;
  db.delete(syncQueue)
    .where(and(eq(syncQueue.userId, userId), inArray(syncQueue.id, ids)))
    .run();
}

/** Compte un échec d'envoi sur des entrées (`attempts + 1`) et garde le message (`last_error`). */
export function markQueueFailure(
  db: Database,
  userId: string,
  ids: string[],
  message: string,
): void {
  if (ids.length === 0) return;
  db.update(syncQueue)
    .set({ attempts: sql`${syncQueue.attempts} + 1`, lastError: message })
    .where(and(eq(syncQueue.userId, userId), inArray(syncQueue.id, ids)))
    .run();
}
