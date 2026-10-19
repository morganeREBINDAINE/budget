// Variables d'environnement injectées par Expo (préfixe EXPO_PUBLIC_, cf. .env.example).
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  }
}
