import { ScreenPlaceholder } from '@/components/screen-placeholder';

export default function LoginScreen() {
  return (
    <ScreenPlaceholder title="Connexion" links={[{ label: 'Continuer avec Google', href: '/' }]} />
  );
}
