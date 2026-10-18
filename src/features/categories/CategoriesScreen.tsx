import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Card,
  ListItem,
  screenPadding,
  ScreenHeader,
  Stack,
  Text,
  useTheme,
} from '@/design-system';
import { mockCategories } from '@/mocks/budget';

import { CategoryIcon } from './components/CategoryIcon';

// Liste des 9 catégories (nombre fixe : pas de virtualisation).
export function CategoriesScreen() {
  const { colors, spacing } = useTheme();
  const categories = [...mockCategories].sort((a, b) => a.position - b.position);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack style={{ paddingHorizontal: screenPadding }}>
        <ScreenHeader title="Catégories" onBack={() => router.back()} />
      </Stack>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: screenPadding,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.sm,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="bodySmall" color="textSecondary">
          Touche une catégorie pour changer son nom, sa couleur ou son icône.
        </Text>
        <Card padding="xs">
          {categories.map((c) => (
            <ListItem
              key={c.id}
              label={c.name}
              icon={<CategoryIcon icon={c.icon} color={c.color} size="sm" />}
              iconBackground="none"
              onPress={() => router.push({ pathname: '/categories/[id]', params: { id: c.id } })}
            />
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
