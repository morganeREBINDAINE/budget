// Envoi à Sentry des erreurs attrapées (synchro, sauvegarde) : sans cela, seules les erreurs non
// attrapées remontent. Contexte technique uniquement (table, opération, nombres, codes d'erreur),
// jamais de payload ni de valeur saisie (docs/STORAGE.md §5) ; le nettoyage de monitoringScrub
// s'applique en plus dans `beforeSend`. Sans effet tant que Sentry n'est pas initialisé (dev, tests).
import * as Sentry from '@sentry/react-native';

type CaptureErrorInput = {
  // Domaine technique (ex. `sync`, `backup`), en tag.
  scope: string;
  // Nature de l'échec (ex. `push-rejected`, `import`), en tag ; regroupe les événements en une issue.
  reason: string;
  // Détails techniques sûrs.
  context?: Record<string, string | number | boolean | null>;
};

export function captureError(error: unknown, { scope, reason, context }: CaptureErrorInput): void {
  Sentry.captureException(error, {
    tags: { scope, reason },
    fingerprint: [scope, reason],
    contexts: context ? { details: context } : undefined,
  });
}
