import { memo } from 'react';
import { Pressable } from 'react-native';

import { Card, Row, Stack, Text, useTheme } from '@/design-system';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { formatAmount, formatListDate } from '@/lib/format';
import type { Category, Transaction } from '@/types/budget';

type Props = {
  transaction: Transaction;
  category: Category | undefined;
  onPress: (id: string) => void;
};

// Ligne de la liste « Détail » (glissement pour supprimer : tâche Transaction).
export const TransactionRow = memo(function TransactionRow({
  transaction,
  category,
  onPress,
}: Props) {
  const { colors, motion } = useTheme();
  const isIncome = transaction.type === 'income';
  const label = isIncome ? 'Entrée' : (category?.name ?? 'Sans catégorie');
  const title = transaction.note ?? label;
  const time = transaction.createdAt.slice(11, 16);

  return (
    <Pressable
      onPress={() => onPress(transaction.id)}
      accessibilityRole="button"
      accessibilityLabel={`${title}, modifier`}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? motion.pressScale : 1 }] })}
    >
      <Card padding="lg" radius="xl">
        <Row gap="md">
          <CategoryIcon
            icon={isIncome ? 'cash-multiple' : (category?.icon ?? 'shape-outline')}
            color={isIncome ? colors.neutralStrong : (category?.color ?? colors.textMuted)}
          />
          <Stack flex={1} gap="xxs">
            <Text variant="heading" numberOfLines={1}>
              {title}
            </Text>
            <Text
              variant="bodySmall"
              color={isIncome ? 'success' : 'textSecondary'}
              numberOfLines={1}
            >
              {formatListDate(transaction.date)}, {time} · {label}
            </Text>
          </Stack>
          <Stack align="flex-end" gap="xxs">
            <Text
              variant="heading"
              weight="extrabold"
              color={isIncome ? 'success' : 'text'}
              tabular
            >
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
    </Pressable>
  );
});
