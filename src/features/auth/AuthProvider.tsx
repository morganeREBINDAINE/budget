import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { secureSessionStorage } from '@/lib/secureSessionStorage';
import { AUTH_STORAGE_KEY, supabase } from '@/lib/supabase';

import { signInWithGoogle as googleSignIn, signOutFromGoogle } from './googleSignIn';
import {
  clearLocalAccount,
  loadLocalAccount,
  saveLocalAccount,
  type LocalAccount,
} from './localAccount';

// Session de l'app (docs/STORAGE.md §4) : « connecté » = compte local présent. Hors ligne, token
// expiré ou session invalidée côté serveur, on reste connecté ; seul `signOut` (manuel) déconnecte.
// `needsReauth` signale une session Supabase absente ou refusée (état « Reconnexion requise », phase 6).

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; account: LocalAccount; needsReauth: boolean };

export type SignInResult =
  { type: 'success' } | { type: 'cancelled' } | { type: 'error'; message: string };

type AuthContextValue = {
  status: AuthState['status'];
  account: LocalAccount | null;
  needsReauth: boolean;
  // `prepareAccount` : préparation des données locales du compte (ex. récupération des catégories),
  // exécutée avant que le compte ne soit considéré connecté ; un échec annule la connexion.
  signInWithGoogle: (prepareAccount: (userId: string) => Promise<void>) => Promise<SignInResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function accountFromUser(user: User): LocalAccount {
  const metadata = user.user_metadata as Record<string, unknown>;
  const name = metadata.full_name ?? metadata.name;
  return { id: user.id, email: user.email ?? null, name: typeof name === 'string' ? name : null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  // Lus par le listener Supabase sans le réabonner.
  const accountRef = useRef<LocalAccount | null>(null);
  const signingOutRef = useRef(false);

  const setNeedsReauth = useCallback((needsReauth: boolean) => {
    setState((current) =>
      current.status === 'signedIn' && current.needsReauth !== needsReauth
        ? { ...current, needsReauth }
        : current,
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    // Ne pas appeler supabase.auth dans ce callback (verrou interne) : travail asynchrone différé.
    const onAuthChange = (event: AuthChangeEvent, session: Session | null) => {
      const account = accountRef.current;
      // Sans compte local, la connexion est gérée explicitement par `signInWithGoogle`.
      if (signingOutRef.current || !account) return;

      if (session) {
        if (session.user.id === account.id) {
          setNeedsReauth(false);
        } else {
          // Reconnexion acceptée uniquement pour le même user_id : on écarte l'autre session.
          console.warn('[auth] session d’un autre compte ignorée');
          setNeedsReauth(true);
          setTimeout(() => void supabase.auth.signOut({ scope: 'local' }), 0);
        }
        return;
      }

      if (event === 'INITIAL_SESSION') {
        // Hors ligne avec un token expiré, le rafraîchissement échoue et la session est émise à
        // null mais reste stockée : seule son absence réelle demande une reconnexion.
        void secureSessionStorage
          .getItem(AUTH_STORAGE_KEY)
          .then((stored) => setNeedsReauth(stored === null))
          .catch((e: unknown) => console.warn('[auth] lecture de la session impossible', e));
      } else if (event === 'SIGNED_OUT') {
        // Refresh refusé par le serveur : on reste connecté localement.
        setNeedsReauth(true);
      }
    };

    loadLocalAccount()
      .catch((e: unknown) => {
        console.error('[auth] lecture du compte local impossible', e);
        return null;
      })
      .then((account) => {
        if (cancelled) return;
        accountRef.current = account;
        setState(
          account ? { status: 'signedIn', account, needsReauth: false } : { status: 'signedOut' },
        );
        const { data } = supabase.auth.onAuthStateChange(onAuthChange);
        unsubscribe = () => data.subscription.unsubscribe();
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [setNeedsReauth]);

  const signInWithGoogle = useCallback(
    async (prepareAccount: (userId: string) => Promise<void>): Promise<SignInResult> => {
      const result = await googleSignIn();
      if (result.type !== 'success') return result;

      const account = accountFromUser(result.user);
      try {
        await prepareAccount(account.id);
      } catch (e) {
        console.error('[auth] préparation des données du compte impossible', e);
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        await signOutFromGoogle().catch(() => undefined);
        return {
          type: 'error',
          message: 'Impossible de récupérer tes catégories. Vérifie ta connexion et réessaie.',
        };
      }
      try {
        await saveLocalAccount(account);
      } catch (e) {
        console.error('[auth] enregistrement du compte local impossible', e);
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        return { type: 'error', message: 'Impossible d’enregistrer le compte sur ce téléphone.' };
      }
      accountRef.current = account;
      setState({ status: 'signedIn', account, needsReauth: false });
      return { type: 'success' };
    },
    [],
  );

  // Déconnexion manuelle : aucune donnée locale ni sync_queue n'est supprimée (docs/STORAGE.md §4).
  const signOut = useCallback(async () => {
    signingOutRef.current = true;
    try {
      // Révoque la session côté serveur si possible ; hors ligne, échoue sans effacer la session.
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) console.warn('[auth] signOut Supabase', error.name, error.message);
      await secureSessionStorage.removeItem(AUTH_STORAGE_KEY);
      // Pour que le sélecteur de compte réapparaisse à la prochaine connexion.
      await signOutFromGoogle().catch((e: unknown) => console.warn('[auth] signOut Google', e));
      await clearLocalAccount();
      accountRef.current = null;
      setState({ status: 'signedOut' });
    } finally {
      signingOutRef.current = false;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      account: state.status === 'signedIn' ? state.account : null,
      needsReauth: state.status === 'signedIn' && state.needsReauth,
      signInWithGoogle,
      signOut,
    }),
    [state, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** `user_id` du compte connecté, à transmettre à tous les repositories. */
export function useUserId(): string {
  const { account } = useAuth();
  if (!account) throw new Error('useUserId doit être utilisé avec un compte connecté');
  return account.id;
}

export function useAuth(): AuthContextValue {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return auth;
}
