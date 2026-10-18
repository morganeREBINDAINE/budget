import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo } from 'react';

import { Card, Row, Stack, Text, useTheme } from '@/design-system';
import { formatAmount, formatListDate } from '@/lib/format';
import type { Category, Transaction } from '@/types/budget';

type Props = { transaction: Transaction; category: Category | undefined };

const ICON_TILE = 48;

// Ligne de la liste « Détail » (glissement pour supprimer : tâche Transaction).
export const TransactionRow = memo(function TransactionRow({ transaction, category }: Props) {
  const { colors, radius } = useTheme();
  const isIncome = transaction.type === 'income';
  const label = isIncome ? 'Entrée' : (category?.name ?? 'Sans catégorie');
  const title = transaction.note ?? label;
  const icon = (
    isIncome ? 'cash-plus' : (category?.icon ?? 'shape-outline')
  ) as keyof typeof MaterialCommunityIcons.glyphMap;

  return (
    <Card padding="md" radius="xl" variant="flat">
      <Row gap="md">
        <Row
          justify="center"
          style={{
            width: ICON_TILE,
            height: ICON_TILE,
            borderRadius: radius.md,
            backgroundColor: isIncome ? colors.success : (category?.color ?? colors.textMuted),
          }}
        >
          <MaterialCommunityIcons name={icon} size={24} color={colors.textOnColor} />
        </Row>
        <Stack flex={1} gap="xxs">
          <Text variant="heading" numberOfLines={1}>
            {title}
          </Text>
          <Text
            variant="bodySmall"
            color={isIncome ? 'success' : 'textSecondary'}
            numberOfLines={1}
          >
            {formatListDate(transaction.date)} · {label}
          </Text>
        </Stack>
        <Stack align="flex-end" gap="xxs">
          <Text variant="heading" weight="extrabold" color={isIncome ? 'success' : 'text'} tabular>
            {formatAmount(isIncome ? transaction.amountDa : -transaction.amountDa, {
              signed: true,
            })}
          </Text>
          {transaction.currency === 'EUR' && (
            <Text variant="caption" color="textMuted">
              Saisi en EUR
            </Text>
          )}
        </Stack>
      </Row>
    </Card>
  );
});
