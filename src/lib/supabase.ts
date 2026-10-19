import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { env } from './env';
import { secureSessionStorage } from './secureSessionStorage';

// Client Supabase unique. Réservé à l'auth et à src/sync/ : les écrans lisent SQLite (docs/STORAGE.md).
// Session persistée chiffrée (lisible hors ligne) ; pas de détection dans l'URL (connexion native, sans redirection).
export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    storage: secureSessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
