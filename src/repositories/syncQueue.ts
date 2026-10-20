import { and, count, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { syncQueue, type SyncedTableName, type SyncQueueRow } from '@/db/schema';

// File d'envoi vers Supabase. Une entrée « mise de côté » (`rejected_at`) a été refusée
// définitivement par Supabase : le push l'ignore, mais elle reste comptée comme non synchronisée.

/** Requête du nombre d'éléments non synchronisés d'un compte, mis de côté compris (à observer). */
export function pendingSyncCountQuery(db: Database, userId: string) {
  return db.select({ value: count() }).from(syncQueue).where(eq(syncQueue.userId, userId));
}

/** Nombre d'éléments non synchronisés d'un compte, mis de côté compris. */
export function pendingSyncCount(db: Database, userId: string): number {
  return pendingSyncCountQuery(db, userId).get()?.value ?? 0;
}

/** Requête du nombre d'éléments mis de côté d'un compte (à observer). */
export function rejectedSyncCountQuery(db: Database, userId: string) {
  return db
    .select({ value: count() })
    .from(syncQueue)
    .where(and(eq(syncQueue.userId, userId), isNotNull(syncQueue.rejectedAt)));
}

/** Nombre d'éléments à envoyer (hors mis de côté). */
export function sendableSyncCount(db: Database, userId: string): number {
  return (
    db
      .select({ value: count() })
      .from(syncQueue)
      .where(and(eq(syncQueue.userId, userId), isNull(syncQueue.rejectedAt)))
      .get()?.value ?? 0
  );
}

/** Plus anciennes entrées à envoyer, dans l'ordre d'écriture (`rowid` : ordre d'insertion). */
export function readQueueBatch(db: Database, userId: string, limit: number): SyncQueueRow[] {
  return db
    .select()
    .from(syncQueue)
    .where(and(eq(syncQueue.userId, userId), isNull(syncQueue.rejectedAt)))
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

/**
 * Retire les entrées mises de côté de lignes dont une version plus récente vient d'être envoyée :
 * elles sont dépassées.
 */
export function removeRejectedEntriesForRows(
  db: Database,
  userId: string,
  tableName: SyncedTableName,
  rowIds: string[],
): void {
  if (rowIds.length === 0) return;
  db.delete(syncQueue)
    .where(
      and(
        eq(syncQueue.userId, userId),
        eq(syncQueue.tableName, tableName),
        inArray(syncQueue.rowId, rowIds),
        isNotNull(syncQueue.rejectedAt),
      ),
    )
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

/** Met de côté des entrées refusées définitivement (`attempts + 1`, `last_error`, `rejected_at`). */
export function rejectQueueEntries(
  db: Database,
  userId: string,
  ids: string[],
  message: string,
  at: string,
): void {
  if (ids.length === 0) return;
  db.update(syncQueue)
    .set({ attempts: sql`${syncQueue.attempts} + 1`, lastError: message, rejectedAt: at })
    .where(and(eq(syncQueue.userId, userId), inArray(syncQueue.id, ids)))
    .run();
}

/** Remet les entrées mises de côté dans la file (« Réessayer »), à leur place d'origine. */
export function requeueRejectedEntries(db: Database, userId: string): void {
  db.update(syncQueue)
    .set({ rejectedAt: null })
    .where(and(eq(syncQueue.userId, userId), isNotNull(syncQueue.rejectedAt)))
    .run();
}
