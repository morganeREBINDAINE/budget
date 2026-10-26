import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Badge, Box, Button, Row, Skeleton, Stack, Text, useTheme } from '@/design-system';
import { formatNumber } from '@/lib/format';
import { daToEur, toDecimalInput } from '@/lib/money';

type Amounts = { incomeDa: number; expenseDa: number; balanceDa: number };

type Props = {
  // Absent pendant le chargement : skeletons à la place des montants.
  amounts?: Amounts;
  // Libellé du reste (défaut « Reste ce mois-ci » ; « Reste sur 12 mois » en vue à l'année).
  label?: string;
  // Vue « Voir en euro » : montants en euros arrondis à ce taux (DA / €) ; null : dinars.
  eurRate?: number | null;
  // Bouton « Voir en euro » / « Revenir en dinars » en bas de l'encart ; absent : pas de bouton.
  onToggleEur?: () => void;
};

const ICON_SIZE = 28;

// Bilan de la période sur fond sombre : reste mis en avant, entrées et dépenses en dessous.
export function MonthBalanceCard({
  amounts,
  label = 'Reste ce mois-ci',
  eurRate = null,
  onToggleEur,
}: Props) {
  const { colors } = useTheme();
  const overdrawn = amounts !== undefined && amounts.balanceDa < 0;
  const skeletonStyle = { backgroundColor: colors.overlayOnColor };
  const unit = eurRate === null ? 'DA' : '€';
  const shown = amounts && displayed(amounts, eurRate);

  return (
    <Box bg="neutralStrong" radius="xl" padding="lg" gap="lg" shadow="card">
      <Stack gap="xs">
        <Row justify="space-between">
          <Text variant="label" color="textMuted">
            {label}
          </Text>
          {overdrawn && <Badge label="Dépassement" variant="danger" />}
        </Row>
        {shown ? (
          <Row align="baseline" gap="xs" wrap>
            <Text variant="display" color="textOnColor" tabular>
              {shown.balance < 0 ? '−' : ''}
              {formatNumber(shown.balance)}
            </Text>
            <Text variant="body" weight="bold" color="textMuted">
              {unit}
            </Text>
          </Row>
        ) : (
          <Skeleton text="display" width="60%" style={skeletonStyle} />
        )}
        {eurRate !== null && (
          <Text variant="bodySmall" color="textMuted">
            Indicatif, au taux de {toDecimalInput(eurRate)} DA / €
          </Text>
        )}
      </Stack>
      <Box style={{ height: 1, backgroundColor: colors.overlayOnColor }} />
      <Row gap="md" align="flex-start">
        <Total kind="income" amount={shown?.income} unit={unit} skeletonStyle={skeletonStyle} />
        <Total kind="expense" amount={shown?.expense} unit={unit} skeletonStyle={skeletonStyle} />
      </Row>
      {amounts && onToggleEur && (
        <Button
          label={eurRate === null ? 'Voir en euro' : 'Revenir en dinars'}
          variant="outline"
          fullWidth
          onPress={onToggleEur}
        />
      )}
    </Box>
  );
}

// Montants affichés : dinars, ou euros arrondis ; en euros, le reste est la différence des deux
// totaux arrondis pour que les trois chiffres restent cohérents.
function displayed(amounts: Amounts, eurRate: number | null) {
  if (eurRate === null)
    return { income: amounts.incomeDa, expense: amounts.expenseDa, balance: amounts.balanceDa };
  const income = daToEur(amounts.incomeDa, eurRate);
  const expense = daToEur(amounts.expenseDa, eurRate);
  return { income, expense, balance: income - expense };
}

function Total({
  kind,
  amount,
  unit,
  skeletonStyle,
}: {
  kind: 'income' | 'expense';
  amount: number | undefined;
  unit: string;
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
      {amount === undefined ? (
        <Skeleton text="heading" width="80%" style={skeletonStyle} />
      ) : (
        <Text variant="heading" weight="bold" color="textOnColor" tabular numberOfLines={1}>
          {isIncome && amount > 0 ? '+' : ''}
          {formatNumber(amount)} {unit}
        </Text>
      )}
    </Stack>
  );
}
