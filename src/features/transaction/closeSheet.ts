import { router } from 'expo-router';

// Ferme la feuille ; si elle a été ouverte sans écran en dessous (lien direct), revient à l'accueil.
export function closeSheet() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
