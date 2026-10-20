import type { Database } from '@/db/client';
import { SYNCED_TABLES, type SyncedTableName } from '@/db/schema';
import { supabase } from '@/lib/supabase';
import { saveRemoteRows } from '@/repositories/remoteRows';
import { getSetting, setSetting } from '@/repositories/settings';
import { remoteSelect, toLocal, type RemoteRow } from '@/sync/columns';
import { requireSession } from '@/sync/session';

// Pull générique (docs/STORAGE.md §3) : récupère les lignes modifiées depuis le dernier pull
// (`updated_at >= last_pulled_at`) pour toutes les tables synchronisées, page par page.
//
// Repère : le plus grand `updated_at` reçu, conservé tel que renvoyé par Postgres (microsecondes
// comprises), jamais l'horloge du téléphone. Il n'est enregistré qu'une fois toutes les tables
// récupérées : après un échec, le pull suivant reprend au même point (enregistrement idempotent).
// Limite assumée (un seul téléphone en v1) : une ligne écrite plus tard par un autre appareil avec
// un `updated_at` antérieur au repère ne serait pas récupérée (cf. Risques de docs/PLAN.md).

/** Taille de page (= limite de lignes par réponse de Supabase). */
export const PAGE_SIZE = 1000;

/** Curseur de pagination : dernière ligne reçue, dans l'ordre `(updated_at, id)`. */
export type PullCursor = { updatedAt: string; id: string };

export type FetchPageParams = {
  tableName: SyncedTableName;
  userId: string;
  // Repère du pull précédent (`null` : tout récupérer).
  since: string | null;
  // Dernière ligne de la page précédente (`null` : première page).
  after: PullCursor | null;
  limit: number;
};

/** Lit une page de lignes distantes triées par `(updated_at, id)`. */
export type FetchPage = (params: FetchPageParams) => Promise<RemoteRow[]>;

const fetchPageFromSupabase: FetchPage = async ({ tableName, userId, since, after, limit }) => {
  let query = supabase.from(tableName).select(remoteSelect(tableName)).eq('user_id', userId);
  if (after) {
    // Pagination par curseur : aucune ligne sautée ni répétée si des données changent pendant le pull.
    query = query.or(
      `updated_at.gt."${after.updatedAt}",and(updated_at.eq."${after.updatedAt}",id.gt.${after.id})`,
    );
  } else if (since) {
    query = query.gte('updated_at', since);
  }
  const { data, error } = await query
    .order('updated_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit)
    .returns<RemoteRow[]>();
  if (error) throw new Error(`Lecture impossible (${tableName}, ${error.code})`);
  return data;
};

// Le plus récent de deux horodatages Postgres (formats variables : comparaison par date).
function latest(current: string | null, candidate: string): string {
  if (current === null) return candidate;
  return Date.parse(candidate) > Date.parse(current) ? candidate : current;
}

/**
 * Récupère et enregistre en local les lignes du compte modifiées depuis le dernier pull, pour toutes
 * les tables, puis avance `last_pulled_at`. `fetchPage` est remplaçable (tests).
 */
export async function pullAll(
  db: Database,
  userId: string,
  fetchPage: FetchPage = fetchPageFromSupabase,
): Promise<void> {
  const since = getSetting(db, userId, 'last_pulled_at');
  let watermark = since;

  for (const tableName of SYNCED_TABLES) {
    let after: PullCursor | null = null;
    for (;;) {
      const page = await fetchPage({ tableName, userId, since, after, limit: PAGE_SIZE });
      // `toLocal` valide chaque ligne (colonnes, horodatages) avant toute écriture.
      saveRemoteRows(
        db,
        userId,
        tableName,
        page.map((remote) => toLocal(tableName, remote)),
      );
      for (const remote of page) watermark = latest(watermark, remote.updated_at as string);
      if (page.length < PAGE_SIZE) break;
      const last = page[page.length - 1];
      after = { updatedAt: last.updated_at as string, id: last.id as string };
    }
  }

  if (watermark !== null && watermark !== since) {
    setSetting(db, userId, 'last_pulled_at', watermark);
  }
}

/** Pull depuis Supabase, après vérification de la session du compte. */
export async function pullFromSupabase(db: Database, userId: string): Promise<void> {
  await requireSession(userId);
  await pullAll(db, userId);
}
