import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Card,
  ListItem,
  minTouchTarget,
  Row,
  screenPadding,
  ScreenHeader,
  Skeleton,
  Stack,
  Text,
  useTheme,
} from '@/design-system';
import { InitialPullError } from '@/features/sync/components/InitialPullError';
import { LoadingRegion } from '@/features/sync/components/Skeletons';
import { useInitialPull } from '@/features/sync/useInitialPull';

import { CategoriesReadError } from './components/CategoriesReadError';
import { CategoryIcon } from './components/CategoryIcon';
import { useCategories } from './useCategories';

// Nombre fixe de catégories (v1).
const CATEGORY_COUNT = 9;

// Liste des 9 catégories (nombre fixe : pas de virtualisation).
export function CategoriesScreen() {
  const { colors, spacing } = useTheme();
  const { ready, failed } = useInitialPull();
  const categories = useCategories();

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
        {failed ? (
          <InitialPullError />
        ) : categories.status === 'error' ? (
          <CategoriesReadError />
        ) : !ready || categories.status === 'loading' ? (
          <LoadingRegion>
            <Card padding="xs">
              {Array.from({ length: CATEGORY_COUNT }, (_, i) => (
                <CategoryRowSkeleton key={i} />
              ))}
            </Card>
          </LoadingRegion>
        ) : (
          <Card padding="xs">
            {categories.data.map((c) => (
              <ListItem
                key={c.id}
                label={c.name}
                icon={<CategoryIcon icon={c.icon} color={c.color} size="sm" />}
                iconBackground="none"
                onPress={() => router.push({ pathname: '/categories/[id]', params: { id: c.id } })}
              />
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Ligne de catégorie pendant le pull initial (même hauteur qu'un ListItem).
function CategoryRowSkeleton() {
  const { spacing } = useTheme();
  return (
    <Row gap="md" style={{ minHeight: minTouchTarget, padding: spacing.sm }}>
      <Skeleton width={36} height={36} radius="md" />
      <Skeleton text="heading" width="45%" />
    </Row>
  );
}
