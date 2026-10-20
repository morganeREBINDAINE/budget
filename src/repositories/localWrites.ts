// Signal « écriture locale » (sans React) : émis par l'outil d'écriture commun après la validation
// d'une transaction SQLite qui a ajouté des entrées à `sync_queue`. Le moteur de synchro s'y abonne
// pour envoyer la file (déclencheur « après chaque écriture si en ligne », docs/STORAGE.md §3).
// Les lignes reçues par le pull ne passent pas par ici : pas de boucle pull → push.

type Listener = (userId: string) => void;

const listeners = new Set<Listener>();

export function subscribeLocalWrites(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Prévient les abonnés ; une erreur d'abonné ne remonte jamais à l'écriture, déjà validée. */
export function notifyLocalWrite(userId: string): void {
  listeners.forEach((listener) => {
    try {
      listener(userId);
    } catch (e) {
      console.error('[sync] abonné aux écritures locales en erreur', e);
    }
  });
}
