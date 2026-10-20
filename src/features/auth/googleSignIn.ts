import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { isAuthRetryableFetchError, type User } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

import { isSameEmail } from './reauth';

// Connexion Google native (CLAUDE.md) : modale système → idToken → session Supabase.
// Aucune redirection web ni deep link.

export type GoogleSignInResult =
  | { type: 'success'; user: User }
  | { type: 'cancelled' }
  // Compte Google différent de celui attendu (reconnexion) : refusé avant tout appel Supabase.
  | { type: 'wrongAccount' }
  | { type: 'error'; message: string };

export type GoogleSignInOptions = {
  // Reconnexion : email du compte local. Un autre compte Google est refusé avant
  // `signInWithIdToken`, qui créerait sinon un nouveau compte Supabase pour cette adresse.
  expectedEmail?: string | null;
};

// Codes CommonStatusCodes de Google Play Services remontés par le module Android.
const NETWORK_ERROR = '7';
const DEVELOPER_ERROR = '10';

const NETWORK_MESSAGE = 'Pas de connexion internet. La première connexion nécessite le réseau.';

let configured = false;

function configure() {
  if (configured) return;
  // Client Web (pas Android) : requis pour obtenir l'idToken.
  GoogleSignin.configure({ webClientId: env.googleWebClientId });
  configured = true;
}

function googleErrorMessage(error: unknown): string | null {
  if (!isErrorWithCode(error)) return null;
  switch (error.code) {
    case statusCodes.IN_PROGRESS:
      return 'Une connexion est déjà en cours.';
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return 'Google Play Services est indisponible ou doit être mis à jour.';
    case NETWORK_ERROR:
      return NETWORK_MESSAGE;
    case DEVELOPER_ERROR:
      return 'Configuration Google invalide (empreinte SHA-1 ou client OAuth).';
    default:
      return null;
  }
}

export async function signInWithGoogle({
  expectedEmail,
}: GoogleSignInOptions = {}): Promise<GoogleSignInResult> {
  try {
    configure();
    // Affiche la boîte de dialogue de mise à jour de Play Services si nécessaire.
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { type: 'cancelled' };

    const { idToken, user: googleUser } = response.data;
    if (expectedEmail && !isSameEmail(googleUser.email, expectedEmail)) {
      // Pour que le sélecteur de compte réapparaisse au prochain essai.
      await GoogleSignin.signOut().catch(() => undefined);
      return { type: 'wrongAccount' };
    }
    if (!idToken) {
      console.error('[auth] idToken absent : vérifier EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
      return { type: 'error', message: 'Google n’a pas renvoyé de jeton. Réessaie.' };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) {
      console.error('[auth] signInWithIdToken', error.name, error.message);
      // Ne pas laisser un compte Google « connecté » sans session Supabase.
      await GoogleSignin.signOut().catch(() => undefined);
      return {
        type: 'error',
        message: isAuthRetryableFetchError(error)
          ? NETWORK_MESSAGE
          : 'Connexion refusée par le serveur. Réessaie plus tard.',
      };
    }
    return { type: 'success', user: data.user };
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) {
      return { type: 'cancelled' };
    }
    console.error('[auth] connexion Google', e);
    return { type: 'error', message: googleErrorMessage(e) ?? 'Connexion impossible. Réessaie.' };
  }
}

export async function signOutFromGoogle(): Promise<void> {
  configure();
  await GoogleSignin.signOut();
}
