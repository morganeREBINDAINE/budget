import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Badge, Box, Row, Skeleton, Stack, Text, useTheme } from '@/design-system';
import { formatNumber } from '@/lib/format';

type Amounts = { incomeDa: number; expenseDa: number; balanceDa: number };

type Props = {
  // Absent pendant le chargement : skeletons à la place des montants.
  amounts?: Amounts;
};

const ICON_SIZE = 28;

// Bilan du mois sur fond sombre : reste mis en avant, entrées et dépenses en dessous.
export function MonthBalanceCard({ amounts }: Props) {
  const { colors } = useTheme();
  const overdrawn = amounts !== undefined && amounts.balanceDa < 0;
  const skeletonStyle = { backgroundColor: colors.overlayOnColor };

  return (
    <Box bg="neutralStrong" radius="xl" padding="lg" gap="lg" shadow="card">
      <Stack gap="xs">
        <Row justify="space-between">
          <Text variant="label" color="textMuted">
            Reste ce mois-ci
          </Text>
          {overdrawn && <Badge label="Dépassement" variant="danger" />}
        </Row>
        {amounts ? (
          <Row align="baseline" gap="xs" wrap>
            <Text variant="display" color="textOnColor" tabular>
              {overdrawn ? '−' : ''}
              {formatNumber(amounts.balanceDa)}
            </Text>
            <Text variant="body" weight="bold" color="textMuted">
              DA
            </Text>
          </Row>
        ) : (
          <Skeleton text="display" width="60%" style={skeletonStyle} />
        )}
      </Stack>
      <Box style={{ height: 1, backgroundColor: colors.overlayOnColor }} />
      <Row gap="md" align="flex-start">
        <Total kind="income" amountDa={amounts?.incomeDa} skeletonStyle={skeletonStyle} />
        <Total kind="expense" amountDa={amounts?.expenseDa} skeletonStyle={skeletonStyle} />
      </Row>
    </Box>
  );
}

function Total({
  kind,
  amountDa,
  skeletonStyle,
}: {
  kind: 'income' | 'expense';
  amountDa: number | undefined;
  skeletonStyle: { backgroundColor: string };
}) {
  const { colors, radius } = useTheme();
  const isIncome = kind === 'income';
  return (
    <Stack flex={1} gap="xs">
      <Row gap="sm">
        <Row
          justify="center"
          style={{
            width: ICON_SIZE,
            height: ICON_SIZE,
            borderRadius: radius.full,
            backgroundColor: isIncome ? colors.successSoft : colors.dangerSoft,
          }}
        >
          <MaterialCommunityIcons
            name={isIncome ? 'arrow-down' : 'arrow-up'}
            size={16}
            color={isIncome ? colors.success : colors.danger}
          />
        </Row>
        <Text variant="label" color="textMuted">
          {isIncome ? 'Entrées' : 'Dépenses'}
        </Text>
      </Row>
      {amountDa === undefined ? (
        <Skeleton text="heading" width="80%" style={skeletonStyle} />
      ) : (
        <Text variant="heading" weight="bold" color="textOnColor" tabular numberOfLines={1}>
          {isIncome && amountDa > 0 ? '+' : ''}
          {formatNumber(amountDa)} DA
        </Text>
      )}
    </Stack>
  );
}
