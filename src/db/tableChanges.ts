import { addDatabaseChangeListener } from 'expo-sqlite';

// Notifications de modification des tables, regroupées. SQLite prévient ligne par ligne : un
// import ou un lot de synchro de plusieurs milliers de lignes déclencherait autant de relectures
// par écran abonné et bloquerait l'app. Un seul écouteur note les tables modifiées et prévient
// chaque abonné une seule fois par rafale : après COALESCE_DELAY_MS sans nouvelle modification, et
// au plus tard après COALESCE_MAX_WAIT_MS si les modifications ne s'arrêtent pas.

/** Délai sans modification avant de prévenir les abonnés. */
export const COALESCE_DELAY_MS = 50;
/** Attente maximale pendant une rafale continue. */
export const COALESCE_MAX_WAIT_MS = 500;

const subscribers = new Map<string, Set<() => void>>();
const dirty = new Set<string>();
let subscription: { remove: () => void } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let burstStartedAt: number | null = null;

function flush() {
  timer = null;
  burstStartedAt = null;
  const tables = [...dirty];
  dirty.clear();
  for (const table of tables) {
    // Copie : un abonné peut se désabonner pendant la notification.
    for (const callback of [...(subscribers.get(table) ?? [])]) callback();
  }
}

function onChange({ tableName }: { tableName: string }) {
  if (!subscribers.has(tableName)) return;
  dirty.add(tableName);
  const now = Date.now();
  burstStartedAt ??= now;
  if (timer) clearTimeout(timer);
  const delay = Math.min(COALESCE_DELAY_MS, burstStartedAt + COALESCE_MAX_WAIT_MS - now);
  timer = setTimeout(flush, Math.max(0, delay));
}

/** Appelle `callback` (une fois par rafale) quand `table` est modifiée. Renvoie le désabonnement. */
export function subscribeTableChanges(table: string, callback: () => void): () => void {
  let callbacks = subscribers.get(table);
  if (!callbacks) {
    callbacks = new Set();
    subscribers.set(table, callbacks);
  }
  callbacks.add(callback);
  subscription ??= addDatabaseChangeListener(onChange);

  return () => {
    const current = subscribers.get(table);
    if (!current) return;
    current.delete(callback);
    if (current.size > 0) return;
    subscribers.delete(table);
    dirty.delete(table);
    if (subscribers.size === 0) {
      subscription?.remove();
      subscription = null;
      if (timer) clearTimeout(timer);
      timer = null;
      burstStartedAt = null;
    }
  };
}
