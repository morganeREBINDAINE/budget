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
import { ReadErrorCard } from '@/features/db/ReadErrorCard';
import { InitialPullError } from '@/features/sync/components/InitialPullError';
import { LoadingRegion, RowSkeletonList } from '@/features/sync/components/Skeletons';
import { formatMonth, type YearMonth } from '@/lib/format';

import { MonthBalanceCard } from './MonthBalanceCard';

type Props = {
  month: YearMonth;
  // Échec du pull : bloc d'erreur (« Réessayer » ou reconnexion) à la place des skeletons.
  failed?: boolean;
  // Échec de la lecture locale du mois (toast déjà affiché) : bloc d'erreur.
  readError?: boolean;
};

const CHART_SIZE = 200;

// Contenu d'un mois pendant le pull initial ou le premier chargement : mêmes blocs que MonthPage,
// données remplacées.
export function HomeSkeleton({ month, failed = false, readError = false }: Props) {
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
      ) : readError ? (
        <ReadErrorCard
          title="Transactions indisponibles"
          message="Impossible de lire les données enregistrées sur le téléphone. Ferme puis rouvre l'application."
        />
      ) : (
        <LoadingRegion gap="xl">
          <Card radius="xl" padding="lg" gap="lg" align="center">
            <Skeleton circle={CHART_SIZE} />
            <Row gap="lg" wrap justify="center">
              <Skeleton text="bodySmall" width={64} />
              <Skeleton text="bodySmall" width={56} />
              <Skeleton text="bodySmall" width={72} />
            </Row>
          </Card>
          <MonthBalanceCard />
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
