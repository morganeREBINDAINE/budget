import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable } from 'react-native';

import { Card, Row, Stack, Text, useTheme } from '@/design-system';
import { formatAmount, formatLongDate } from '@/lib/format';
import type { DebtRepayment } from '@/types/budget';

type Props = {
  repayment: DebtRepayment;
  onPress: (id: string) => void;
};

const ICON_TILE = 40;

// Ligne d'un remboursement (appui : modifier ou supprimer).
export const RepaymentRow = memo(function RepaymentRow({ repayment, onPress }: Props) {
  const { colors, radius, motion } = useTheme();
  return (
    <Pressable
      onPress={() => onPress(repayment.id)}
      accessibilityRole="button"
      accessibilityLabel={`Remboursement de ${formatAmount(repayment.amountDa)} le ${formatLongDate(repayment.date)}, modifier`}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? motion.pressScale : 1 }] })}
    >
      <Card padding="md" radius="lg" variant="flat">
        <Row gap="md">
          <Stack
            align="center"
            justify="center"
            style={{
              width: ICON_TILE,
              height: ICON_TILE,
              borderRadius: radius.md,
              backgroundColor: colors.successSoft,
            }}
          >
            <MaterialCommunityIcons name="cash-refund" size={22} color={colors.success} />
          </Stack>
          <Stack flex={1} gap="xxs">
            <Text variant="body" weight="bold" numberOfLines={1}>
              {formatLongDate(repayment.date)}
            </Text>
            {repayment.note ? (
              <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
                {repayment.note}
              </Text>
            ) : null}
          </Stack>
          <Stack align="flex-end" gap="xxs">
            <Text variant="heading" weight="extrabold" color="success" tabular>
              {formatAmount(repayment.amountDa)}
            </Text>
            {repayment.currency === 'EUR' && (
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
