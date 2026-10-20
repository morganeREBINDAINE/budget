import { ScrollView } from 'react-native';

import {
  Card,
  FAB_AREA_HEIGHT,
  Row,
  screenPadding,
  Skeleton,
  Stack,
  Text,
  useTheme,
} from '@/design-system';
import { InitialPullError } from '@/features/sync/components/InitialPullError';
import { LoadingRegion, RowSkeletonList } from '@/features/sync/components/Skeletons';
import { formatMonth, type YearMonth } from '@/lib/format';

type Props = {
  month: YearMonth;
  // Échec du pull : bloc d'erreur (« Réessayer » ou reconnexion) à la place des skeletons.
  failed?: boolean;
};

const CHART_SIZE = 200;

// Contenu d'un mois pendant le pull initial : mêmes blocs que MonthPage, données remplacées.
export function HomeSkeleton({ month, failed = false }: Props) {
  const { spacing } = useTheme();
  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: screenPadding,
        paddingTop: spacing.xl,
        paddingBottom: FAB_AREA_HEIGHT + spacing.xl,
      }}
      showsVerticalScrollIndicator={false}
    >
      {failed ? (
        <InitialPullError />
      ) : (
        <LoadingRegion gap="xl">
          <Row gap="md" align="stretch">
            <TotalCardSkeleton label="Entrées" />
            <TotalCardSkeleton label="Dépenses" />
          </Row>
          <Card radius="xl" padding="lg" gap="lg" align="center">
            <Skeleton circle={CHART_SIZE} />
            <Row gap="lg" wrap justify="center">
              <Skeleton text="bodySmall" width={64} />
              <Skeleton text="bodySmall" width={56} />
              <Skeleton text="bodySmall" width={72} />
            </Row>
          </Card>
          <Stack gap="lg">
            <Row gap="sm" align="baseline">
              <Text variant="title">Détail</Text>
              <Text variant="body" color="textMuted">
                {formatMonth(month)}
              </Text>
            </Row>
            <RowSkeletonList />
          </Stack>
        </LoadingRegion>
      )}
    </ScrollView>
  );
}

function TotalCardSkeleton({ label }: { label: string }) {
  return (
    <Card flex={1} gap="sm" radius="xl">
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <Skeleton text="title" width="70%" />
      <Skeleton text="bodySmall" width="50%" />
    </Card>
  );
}
