import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo } from 'react';

import { Button, Row, Stack, Text, useTheme } from '@/design-system';
import { daysBetween, formatAmount, formatLateness, formatLongDate, toIsoDate } from '@/lib/format';
import type { DuePayment } from '@/types/budget';

type Props = {
  due: DuePayment;
  onPay: (due: DuePayment) => void;
  // Vue « Voir en euro » de l'accueil : montant en euros arrondis à ce taux ; null : dinars.
  eurRate?: number | null;
};

const ICON_TILE = 40;

// Encart rouge d'une échéance arrivée et non payée (reste affiché jusqu'à « J'ai payé »).
export const DuePaymentBanner = memo(function DuePaymentBanner({
  due,
  onPay,
  eurRate = null,
}: Props) {
  const { colors, radius } = useTheme();
  const late = daysBetween(due.dueDate, toIsoDate(new Date()));
  const amount = formatAmount(due.payment.amountDa, { eurRate });
  const when =
    late > 0
      ? `Échéance du ${formatLongDate(due.dueDate)} · ${formatLateness(late)}`
      : "À payer aujourd'hui";

  return (
    <Stack
      bg="danger"
      radius="xl"
      padding="lg"
      gap="md"
      shadow="sm"
      accessibilityRole="alert"
      accessibilityLabel={`${due.payment.name}, ${amount}, ${when}`}
    >
      <Row gap="md">
        <Stack
          align="center"
          justify="center"
          style={{
            width: ICON_TILE,
            height: ICON_TILE,
            borderRadius: radius.md,
            backgroundColor: colors.overlayOnColor,
          }}
        >
          <MaterialCommunityIcons name="calendar-alert" size={22} color={colors.textOnColor} />
        </Stack>
        <Stack flex={1} gap="xxs">
          <Row justify="space-between" gap="sm">
            <Text variant="heading" color="textOnColor" numberOfLines={1} style={{ flex: 1 }}>
              {due.payment.name}
            </Text>
            <Text variant="heading" weight="extrabold" color="textOnColor" tabular>
              {amount}
            </Text>
          </Row>
          <Text variant="bodySmall" weight="semibold" color="textOnColor">
            {when}
          </Text>
        </Stack>
      </Row>
      <Button label="J'ai payé" variant="outline" size="sm" fullWidth onPress={() => onPay(due)} />
    </Stack>
  );
});
