import { showToast } from './toast';

type ReportErrorInput = {
  // Domaine technique, préfixe du journal (ex. `sync`, `db`, `auth`).
  scope: string;
  // Message compréhensible affiché à l'utilisateur, sans montant ni note.
  message: string;
  error: unknown;
  // Clé anti-doublon (défaut : scope + message).
  key?: string;
};

/**
 * Point d'entrée des erreurs hors formulaire (docs/STORAGE.md §5) :
 * journalise le détail technique et affiche un toast de 3 s.
 */
export function reportError({ scope, message, error, key }: ReportErrorInput): void {
  console.error(`[${scope}] ${message}`, error);
  showToast({ message, variant: 'error', key: key ?? `${scope}:${message}` });
}
