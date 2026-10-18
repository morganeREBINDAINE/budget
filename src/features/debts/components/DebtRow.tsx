import { memo } from 'react';
import { Pressable } from 'react-native';

import { Avatar, Badge, Card, Row, Stack, Text, useTheme } from '@/design-system';
import { formatAmount, formatLongDate, initials } from '@/lib/format';

import type { DebtItem } from '../useDebts';
import { ProgressBar } from './ProgressBar';

type Props = {
  item: DebtItem;
  onPress: (id: string) => void;
};

const SETTLED_OPACITY = 0.55;

// Ligne de la liste des dettes : personne, date, note, reste dû et progression.
export const DebtRow = memo(function DebtRow({ item, onPress }: Props) {
  const { motion } = useTheme();
  const { debt, person } = item;
  const name = person?.name ?? 'Personne inconnue';
  const settled = item.remainingDa === 0;
  const details = [formatLongDate(debt.date), debt.note].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={() => onPress(debt.id)}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${settled ? 'soldée' : `reste ${formatAmount(item.remainingDa)}`}, modifier`}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? motion.pressScale : 1 }] })}
    >
      <Card padding="lg" radius="xl" gap="md" variant={settled ? 'muted' : 'elevated'}>
        <Row gap="md" style={{ opacity: settled ? SETTLED_OPACITY : 1 }}>
          <Avatar initials={initials(name)} variant="neutral" />
          <Stack flex={1} gap="xxs">
            <Text variant="heading" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
              {details}
            </Text>
          </Stack>
          <Stack align="flex-end" gap="xxs">
            <Text variant="heading" weight="extrabold" tabular>
              {formatAmount(settled ? debt.amountDa : item.remainingDa)}
            </Text>
            <Text variant="caption" color="textMuted" tabular>
              {settled
                ? debt.currency === 'EUR'
                  ? 'Saisi en EUR'
                  : 'Montant initial'
                : `sur ${formatAmount(debt.amountDa)}`}
            </Text>
          </Stack>
        </Row>
        {settled ? (
          <Badge label="Soldée" variant="success" />
        ) : (
          <ProgressBar progress={item.repaidDa / debt.amountDa} />
        )}
      </Card>
    </Pressable>
  );
});
