import { memo } from 'react';
import { Pressable } from 'react-native';

import { Badge, Card, Row, Stack, Text, useTheme } from '@/design-system';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { daysBetween, formatAmount, formatLateness, formatLongDate, toIsoDate } from '@/lib/format';
import type { Category, RecurringPayment } from '@/types/budget';

import { formatRecurrence } from '../recurrence';

type Props = {
  payment: RecurringPayment;
  category: Category | undefined;
  // YYYY-MM-DD, null si inactif.
  nextDueDate: string | null;
  onPress: (id: string) => void;
};

const INACTIVE_OPACITY = 0.55;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function dueLabel(nextDueDate: string): { text: string; late: boolean } {
  const days = daysBetween(nextDueDate, toIsoDate(new Date()));
  if (days > 0) return { text: capitalize(formatLateness(days)), late: true };
  if (days === 0) return { text: "À payer aujourd'hui", late: true };
  return { text: `Prochaine échéance : ${formatLongDate(nextDueDate)}`, late: false };
}

// Ligne de la liste des paiements réguliers.
export const RecurringRow = memo(function RecurringRow({
  payment,
  category,
  nextDueDate,
  onPress,
}: Props) {
  const { colors, motion } = useTheme();
  const due = payment.active && nextDueDate ? dueLabel(nextDueDate) : null;

  return (
    <Pressable
      onPress={() => onPress(payment.id)}
      accessibilityRole="button"
      accessibilityLabel={`${payment.name}, modifier`}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? motion.pressScale : 1 }] })}
    >
      <Card padding="lg" radius="xl" gap="sm">
        <Row gap="md" style={{ opacity: payment.active ? 1 : INACTIVE_OPACITY }}>
          <CategoryIcon
            icon={category?.icon ?? 'shape-outline'}
            color={category?.color ?? colors.textMuted}
          />
          <Stack flex={1} gap="xxs">
            <Text variant="heading" numberOfLines={1}>
              {payment.name}
            </Text>
            <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
              {formatRecurrence(payment)} · {category?.name ?? 'Sans catégorie'}
            </Text>
          </Stack>
          <Text variant="heading" weight="extrabold" tabular>
            {formatAmount(payment.amountDa)}
          </Text>
        </Row>
        {due ? (
          <Text
            variant="bodySmall"
            weight="semibold"
            color={due.late ? 'danger' : 'textSecondary'}
            numberOfLines={1}
          >
            {due.text}
          </Text>
        ) : (
          <Badge label="Inactif" />
        )}
      </Card>
    </Pressable>
  );
});
