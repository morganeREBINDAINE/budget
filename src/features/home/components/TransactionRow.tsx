import * as Haptics from 'expo-haptics';
import { memo } from 'react';
import { Pressable } from 'react-native';

import { Card, Row, Stack, Text, useTheme } from '@/design-system';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { formatAmount, formatListDate, formatTime } from '@/lib/format';
import { transactionLabel } from '@/lib/transactionSearch';
import type { Category, Transaction } from '@/types/budget';

type Props = {
  transaction: Transaction;
  category: Category | undefined;
  onPress: (id: string) => void;
  // Appui long : demande de suppression (pas de glissement, réservé au changement de mois).
  onLongPress: (transaction: Transaction) => void;
  // Vue « Voir en euro » : montant en euros arrondis à ce taux ; null : dinars.
  eurRate?: number | null;
};

// Ligne de la liste « Détail » : appui → modifier, appui long → supprimer.
export const TransactionRow = memo(function TransactionRow({
  transaction,
  category,
  onPress,
  onLongPress,
  eurRate = null,
}: Props) {
  const { colors, motion } = useTheme();
  const isIncome = transaction.type === 'income';
  const label = transactionLabel(transaction, category);
  const title = transaction.note ?? label;
  const time = formatTime(transaction.createdAt);
  const requestDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onLongPress(transaction);
  };

  return (
    <Pressable
      onPress={() => onPress(transaction.id)}
      onLongPress={requestDelete}
      accessibilityRole="button"
      accessibilityLabel={`${title}, modifier`}
      accessibilityHint="Appui long pour supprimer"
      // L'appui long est caché : action « Supprimer » proposée aussi aux lecteurs d'écran.
      accessibilityActions={[{ name: 'delete', label: 'Supprimer' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'delete') onLongPress(transaction);
      }}
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
                eurRate,
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
