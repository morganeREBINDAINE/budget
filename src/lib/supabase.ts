import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { env } from './env';
import { secureSessionStorage } from './secureSessionStorage';

// Clé fixe de la session stockée : relue par AuthProvider (session expirée hors ligne) et
// supprimée à la déconnexion manuelle (signOut échoue hors ligne sans l'effacer).
export const AUTH_STORAGE_KEY = 'budget-auth-session';

// Client Supabase unique. Réservé à l'auth et à src/sync/ : les écrans lisent SQLite (docs/STORAGE.md).
// Session persistée chiffrée (lisible hors ligne) ; pas de détection dans l'URL (connexion native, sans redirection).
export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    storage: secureSessionStorage,
    storageKey: AUTH_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
