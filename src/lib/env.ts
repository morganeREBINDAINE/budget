// Configuration lue dans .env (cf. .env.example). Les variables doivent être lues en notation
// pointée `process.env.EXPO_PUBLIC_X` pour être injectées par Expo (pas de déstructuration).
// Une variable manquante est une erreur de configuration : levée dès le chargement du module.

function required(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${name} manquante : copier .env.example vers .env et la renseigner.`);
  }
  return trimmed;
}

const supabaseUrl = required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL);
if (!supabaseUrl.startsWith('https://')) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL invalide : doit commencer par https://.');
}

const supabasePublishableKey = required(
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
// Garde-fou : une clé secrète serait lisible en clair dans l'APK.
if (supabasePublishableKey.startsWith('sb_secret_')) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY : clé secrète interdite, utiliser la clé publishable.',
  );
}

// Client OAuth de type Web (pas Android) : requis pour obtenir l'idToken. Identifiant public.
const googleWebClientId = required(
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
);
if (!googleWebClientId.endsWith('.apps.googleusercontent.com')) {
  throw new Error(
    'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID invalide : doit se terminer par .apps.googleusercontent.com.',
  );
}

// DSN Sentry : identifiant public (lisible dans l'APK), n'autorise que l'envoi d'événements.
const sentryDsn = required('EXPO_PUBLIC_SENTRY_DSN', process.env.EXPO_PUBLIC_SENTRY_DSN);
if (!/^https:\/\/[^@]+@[^/]+\/\d+$/.test(sentryDsn)) {
  throw new Error('EXPO_PUBLIC_SENTRY_DSN invalide : format https://<clé>@<hôte>/<projet>.');
}

export const env = {
  supabaseUrl,
  supabasePublishableKey,
  googleWebClientId,
  sentryDsn,
} as const;
