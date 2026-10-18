import { ScreenPlaceholder } from '@/components/screen-placeholder';

export default function AccountScreen() {
  return (
    <ScreenPlaceholder title="Compte" links={[{ label: 'Catégories', href: '/categories' }]} />
  );
}
