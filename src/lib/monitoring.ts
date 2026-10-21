// Suivi des erreurs (Sentry). Importé en premier par index.ts : les erreurs de la tâche de fond,
// lancée par Android sans écran, sont aussi capturées. Désactivé en développement.
import * as Sentry from '@sentry/react-native';

import { env } from './env';
import { redactSensitive, scrubBreadcrumb } from './monitoringScrub';

Sentry.init({
  dsn: env.sentryDsn,
  enabled: !__DEV__,
  // Ni IP ni données personnelles ajoutées automatiquement ; seul l'id du compte est envoyé.
  sendDefaultPii: false,
  // Pas de tracing de performance ni de Session Replay (enregistrement de l'écran).
  beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  beforeSend: (event) => redactSensitive(event),
});

/**
 * Associe les événements au compte connecté par son id Supabase uniquement (UUID, ni email ni
 * nom), pour compter les utilisateurs touchés ; `null` à la déconnexion.
 */
export function setMonitoringUser(userId: string | null): void {
  Sentry.setUser(userId ? { id: userId } : null);
}

export const withMonitoring = Sentry.wrap;
