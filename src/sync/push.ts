import type { Database } from '@/db/client';
import type { SyncedTableName } from '@/db/schema';
import { supabase } from '@/lib/supabase';
import {
  markQueueFailure,
  pendingSyncCount,
  readQueueBatch,
  removeQueueEntries,
} from '@/repositories/syncQueue';
import { toRemote, type RemoteRow } from '@/sync/columns';
import { requireSession } from '@/sync/session';

// Push (docs/STORAGE.md §3) : vide la file `sync_queue` du compte dans l'ordre d'écriture, par lots.
// Chaque table d'un lot part en un upsert par id (relançable sans doublon ; côté Supabase, le trigger
// skip_stale_update ignore une version qui n'est pas plus récente). Une entrée n'est retirée de la
// file qu'après confirmation de Supabase. Au premier échec, les entrées non envoyées du lot sont
// marquées (`attempts`, `last_error`), le push s'arrête et l'erreur remonte : l'ordre est préservé.

/** Nombre d'entrées de file lues par lot. */
export const PUSH_BATCH_SIZE = 200;

/** Envoie des lignes (snake_case) d'une table ; rejette en cas d'échec. */
export type UpsertRows = (tableName: SyncedTableName, rows: RemoteRow[]) => Promise<void>;

/** Avancement : entrées envoyées / total au départ (le total grandit si on écrit pendant l'envoi). */
export type PushProgress = (sent: number, total: number) => void;

const upsertToSupabase: UpsertRows = async (tableName, rows) => {
  const { error } = await supabase.from(tableName).upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Envoi impossible (${tableName}, ${error.code})`);
};

type TableGroup = { entryIds: string[]; rows: Map<string, Record<string, unknown>> };

// Regroupe un lot par table ; une ligne écrite plusieurs fois n'est envoyée qu'une fois, dans sa
// dernière version (Postgres refuse de modifier deux fois la même ligne dans un même upsert).
function groupByTable(batch: ReturnType<typeof readQueueBatch>): Map<SyncedTableName, TableGroup> {
  const groups = new Map<SyncedTableName, TableGroup>();
  for (const entry of batch) {
    let group = groups.get(entry.tableName);
    if (!group) {
      group = { entryIds: [], rows: new Map() };
      groups.set(entry.tableName, group);
    }
    group.entryIds.push(entry.id);
    group.rows.set(entry.rowId, entry.payload);
  }
  return groups;
}

/** Envoie toute la file du compte. `upsert` est remplaçable (tests). */
export async function pushAll(
  db: Database,
  userId: string,
  upsert: UpsertRows = upsertToSupabase,
  onProgress?: PushProgress,
): Promise<void> {
  let total = pendingSyncCount(db, userId);
  let sent = 0;
  onProgress?.(0, total);

  for (;;) {
    const batch = readQueueBatch(db, userId, PUSH_BATCH_SIZE);
    if (batch.length === 0) return;
    let unsent = batch.map((entry) => entry.id);

    for (const [tableName, group] of groupByTable(batch)) {
      try {
        const rows = [...group.rows.values()].map((payload) => {
          if (payload.userId !== userId) throw new Error(`Entrée d’un autre compte (${tableName})`);
          return toRemote(tableName, payload);
        });
        await upsert(tableName, rows);
      } catch (e) {
        markQueueFailure(db, userId, unsent, e instanceof Error ? e.message : 'Envoi impossible');
        throw e;
      }
      removeQueueEntries(db, userId, group.entryIds);
      unsent = unsent.filter((id) => !group.entryIds.includes(id));
      sent += group.entryIds.length;
      total = Math.max(total, sent);
      onProgress?.(sent, total);
    }
  }
}

/** Push vers Supabase, après vérification de la session du compte. */
export async function pushToSupabase(
  db: Database,
  userId: string,
  onProgress?: PushProgress,
): Promise<void> {
  await requireSession(userId);
  await pushAll(db, userId, upsertToSupabase, onProgress);
}
