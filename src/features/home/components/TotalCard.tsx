import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card, Row, Text, useTheme } from '@/design-system';
import { formatNumber } from '@/lib/format';

type Props = {
  kind: 'income' | 'expense';
  amountDa: number;
  subtitle: string;
};

const ICON_SIZE = 32;

// Carte de total du mois (affichage seul).
export function TotalCard({ kind, amountDa, subtitle }: Props) {
  const { colors, radius } = useTheme();
  const isIncome = kind === 'income';
  return (
    <Card flex={1} gap="sm" radius="xl">
      <Row justify="space-between">
        <Text variant="label" color="textSecondary">
          {isIncome ? 'Entrées' : 'Dépenses'}
        </Text>
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
            name={isIncome ? 'arrow-bottom-left' : 'arrow-top-right'}
            size={18}
            color={isIncome ? colors.success : colors.danger}
          />
        </Row>
      </Row>
      <Row align="baseline" gap="xs" wrap>
        <Text variant="title" weight="extrabold" color={isIncome ? 'success' : 'text'} tabular>
          {isIncome && amountDa > 0 ? '+' : ''}
          {formatNumber(amountDa)}
        </Text>
        <Text variant="bodySmall" weight="bold" color={isIncome ? 'success' : 'textMuted'}>
          DA
        </Text>
      </Row>
      <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
        {subtitle}
      </Text>
    </Card>
  );
}
