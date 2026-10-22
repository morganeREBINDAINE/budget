import type { Database } from '@/db/client';
import type { SyncedTableName, SyncQueueRow } from '@/db/schema';
import { captureError } from '@/lib/captureError';
import { supabase } from '@/lib/supabase';
import {
  markQueueFailure,
  readQueueBatch,
  rejectQueueEntries,
  removeQueueEntries,
  removeRejectedEntriesForRows,
  sendableSyncCount,
} from '@/repositories/syncQueue';
import { toRemote, type RemoteRow } from '@/sync/columns';
import { requireSession } from '@/sync/session';

// Push (docs/STORAGE.md §3) : vide la file `sync_queue` du compte dans l'ordre d'écriture, par lots.
// Chaque table d'un lot part en un upsert par id (relançable sans doublon ; côté Supabase, le trigger
// skip_stale_update ignore une version qui n'est pas plus récente). Les suppressions définitives
// (entrées `delete`, HARD_DELETABLE_TABLES) partent avant les upserts de la même table : elles
// libèrent les valeurs uniques (ex. nom d'une personne recréée). Supprimer une ligne déjà absente
// n'est pas une erreur (relançable). Une entrée n'est retirée de la file qu'après confirmation de
// Supabase.
//
// Erreurs :
// - refus de la ligne (donnée invalide pour le serveur : renvoyer la même ligne échouera toujours) :
//   le groupe est renvoyé ligne par ligne pour isoler la ou les lignes fautives, qui sont mises de
//   côté (`rejected_at`) ; les autres partent, la file n'est pas bloquée ;
// - erreur passagère (réseau, serveur, configuration) : les entrées non envoyées du lot sont
//   marquées (`attempts`, `last_error`), le push s'arrête et l'erreur remonte (ordre préservé).

/** Nombre d'entrées de file lues par lot. */
export const PUSH_BATCH_SIZE = 200;

export type PushErrorKind = 'rejected' | 'transient';

/** Échec d'envoi avec sa nature : refus de la ligne ou erreur passagère. */
export class PushError extends Error {
  constructor(
    message: string,
    readonly kind: PushErrorKind,
  ) {
    super(message);
    this.name = 'PushError';
  }
}

/**
 * Nature d'une erreur Postgres / PostgREST d'après son code. Refus de la ligne : `22xxx` (donnée
 * invalide), `23xxx` (contrainte : unicité, CHECK, NOT NULL), `42501` (RLS). Tout le reste est
 * passager : réseau (code vide), PostgREST (`PGRST…`), colonne inconnue (migration non appliquée)…
 */
export function classifyErrorCode(code: string | undefined): PushErrorKind {
  if (code && (/^2[23]/.test(code) || code === '42501')) return 'rejected';
  return 'transient';
}

const isRejection = (e: unknown) => e instanceof PushError && e.kind === 'rejected';
const messageOf = (e: unknown) => (e instanceof Error ? e.message : 'Envoi impossible');

/** Envoie des lignes (snake_case) d'une table ; rejette en cas d'échec (`PushError` si classé). */
export type UpsertRows = (tableName: SyncedTableName, rows: RemoteRow[]) => Promise<void>;

/** Supprime définitivement des lignes d'une table par id ; rejette comme `UpsertRows`. */
export type DeleteRows = (tableName: SyncedTableName, ids: string[]) => Promise<void>;

/** Avancement : entrées traitées / total au départ (le total grandit si on écrit pendant l'envoi). */
export type PushProgress = (done: number, total: number) => void;

/** Bilan du push : entrées envoyées et entrées mises de côté. */
export type PushResult = { sent: number; rejected: number };

const upsertToSupabase: UpsertRows = async (tableName, rows) => {
  const { error } = await supabase.from(tableName).upsert(rows, { onConflict: 'id' });
  if (error) {
    throw new PushError(
      `Envoi impossible (${tableName}, ${error.code || 'réseau'})`,
      classifyErrorCode(error.code),
    );
  }
};

const deleteFromSupabase =
  (userId: string): DeleteRows =>
  async (tableName, ids) => {
    const { error } = await supabase.from(tableName).delete().eq('user_id', userId).in('id', ids);
    if (error) {
      throw new PushError(
        `Suppression impossible (${tableName}, ${error.code || 'réseau'})`,
        classifyErrorCode(error.code),
      );
    }
  };

// Une ligne à envoyer : sa dernière opération (version ou suppression) et toutes ses entrées du lot.
type PendingRow = {
  rowId: string;
  op: SyncQueueRow['op'];
  payload: Record<string, unknown>;
  entryIds: string[];
};

// Regroupe un lot par table puis par ligne : une ligne écrite plusieurs fois n'est envoyée qu'une
// fois, dans sa dernière opération (Postgres refuse de modifier deux fois la même ligne d'un upsert).
function groupByTable(batch: SyncQueueRow[]): Map<SyncedTableName, PendingRow[]> {
  const groups = new Map<SyncedTableName, Map<string, PendingRow>>();
  for (const entry of batch) {
    let rows = groups.get(entry.tableName);
    if (!rows) {
      rows = new Map();
      groups.set(entry.tableName, rows);
    }
    const row = rows.get(entry.rowId);
    if (row) {
      row.op = entry.op;
      row.payload = entry.payload;
      row.entryIds.push(entry.id);
    } else {
      rows.set(entry.rowId, {
        rowId: entry.rowId,
        op: entry.op,
        payload: entry.payload,
        entryIds: [entry.id],
      });
    }
  }
  return new Map([...groups].map(([tableName, rows]) => [tableName, [...rows.values()]]));
}

/**
 * Envoie toute la file du compte (hors entrées mises de côté). `upsert` et `remove` sont
 * remplaçables (tests).
 */
export async function pushAll(
  db: Database,
  userId: string,
  upsert: UpsertRows = upsertToSupabase,
  onProgress?: PushProgress,
  remove: DeleteRows = deleteFromSupabase(userId),
): Promise<PushResult> {
  let total = sendableSyncCount(db, userId);
  const result: PushResult = { sent: 0, rejected: 0 };
  onProgress?.(0, total);

  const report = (count: number) => {
    const done = result.sent + result.rejected;
    total = Math.max(total, done);
    if (count > 0) onProgress?.(done, total);
  };

  const sent = (tableName: SyncedTableName, rows: PendingRow[]) => {
    const entryIds = rows.flatMap((row) => row.entryIds);
    removeQueueEntries(db, userId, entryIds);
    // Une version plus récente est passée : les versions mises de côté sont dépassées.
    removeRejectedEntriesForRows(
      db,
      userId,
      tableName,
      rows.map((row) => row.rowId),
    );
    result.sent += entryIds.length;
    report(entryIds.length);
  };

  // Refus du push regroupés par table, opération et raison (message technique, sans valeur) :
  // un seul événement Sentry par push.
  const rejections = new Map<string, number>();
  const reject = (tableName: SyncedTableName, row: PendingRow, e: unknown) => {
    const key = `${tableName} ${row.op} : ${messageOf(e)}`;
    rejections.set(key, (rejections.get(key) ?? 0) + row.entryIds.length);
    rejectQueueEntries(db, userId, row.entryIds, messageOf(e), new Date().toISOString());
    result.rejected += row.entryIds.length;
    report(row.entryIds.length);
  };

  // Envoi sans lever : l'appelant décide selon la nature de l'erreur.
  type Item = { row: PendingRow; remote: RemoteRow };
  const trySend = async (tableName: SyncedTableName, op: PendingRow['op'], items: Item[]) => {
    try {
      if (op === 'delete') {
        await remove(
          tableName,
          items.map((item) => item.row.rowId),
        );
      } else {
        await upsert(
          tableName,
          items.map((item) => item.remote),
        );
      }
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error };
    }
  };

  try {
    return await pushBatches();
  } finally {
    if (rejections.size > 0) {
      captureError(new Error('Éléments refusés par le serveur'), {
        scope: 'sync',
        reason: 'push-rejected',
        context: { rejected: result.rejected, ...Object.fromEntries(rejections) },
      });
    }
  }

  async function pushBatches(): Promise<PushResult> {
    for (;;) {
      const batch = readQueueBatch(db, userId, PUSH_BATCH_SIZE);
      if (batch.length === 0) return result;
      const processed = new Set<string>();
      const markProcessed = (row: PendingRow) => row.entryIds.forEach((id) => processed.add(id));
      // Erreur passagère : entrées non traitées du lot marquées, arrêt du push.
      const stop = (e: unknown): never => {
        const unsent = batch.map((entry) => entry.id).filter((id) => !processed.has(id));
        markQueueFailure(db, userId, unsent, messageOf(e));
        throw e;
      };

      for (const [tableName, rows] of groupByTable(batch)) {
        // Payload local inconvertible (autre compte, colonne inconnue) : refus sans envoi.
        const toSend: Item[] = [];
        for (const row of rows) {
          try {
            if (row.payload.userId !== userId) {
              throw new Error(`Entrée d’un autre compte (${tableName})`);
            }
            toSend.push({
              row,
              remote: row.op === 'delete' ? {} : toRemote(tableName, row.payload),
            });
          } catch (e) {
            reject(tableName, row, e);
            markProcessed(row);
          }
        }

        // Suppressions d'abord, puis versions.
        for (const op of ['delete', 'upsert'] as const) {
          const items = toSend.filter((item) => item.row.op === op);
          if (items.length === 0) continue;

          const grouped = await trySend(tableName, op, items);
          if (grouped.ok) {
            sent(
              tableName,
              items.map((item) => item.row),
            );
            items.forEach((item) => markProcessed(item.row));
            continue;
          }
          if (!isRejection(grouped.error)) stop(grouped.error);
          if (items.length === 1) {
            reject(tableName, items[0].row, grouped.error);
            markProcessed(items[0].row);
            continue;
          }

          // Refus d'un envoi groupé : renvoi ligne par ligne pour isoler la ou les lignes fautives.
          for (const item of items) {
            const single = await trySend(tableName, op, [item]);
            if (single.ok) sent(tableName, [item.row]);
            else if (isRejection(single.error)) reject(tableName, item.row, single.error);
            else stop(single.error);
            markProcessed(item.row);
          }
        }
      }
    }
  }
}

/** Push vers Supabase, après vérification de la session du compte. */
export async function pushToSupabase(
  db: Database,
  userId: string,
  onProgress?: PushProgress,
): Promise<PushResult> {
  await requireSession(userId);
  return pushAll(db, userId, upsertToSupabase, onProgress);
}
