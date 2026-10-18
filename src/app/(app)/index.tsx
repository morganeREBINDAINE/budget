import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { useTheme } from '@/design-system';

export default function HomeScreen() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenPlaceholder
        title="Accueil"
        links={[
          {
            label: 'Ajouter entrée',
            href: { pathname: '/transaction/new', params: { type: 'income' } },
          },
          {
            label: 'Ajouter dépense',
            href: { pathname: '/transaction/new', params: { type: 'expense' } },
          },
          {
            label: 'Modifier une transaction',
            href: { pathname: '/transaction/[id]', params: { id: 'demo' } },
          },
          { label: 'Compte', href: '/account' },
          { label: 'Connexion', href: '/login' },
        ]}
      />
    </SafeAreaView>
  );
}
