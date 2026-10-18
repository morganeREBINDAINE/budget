import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import { Box, Card, Row, Stack, Text, useTheme } from '@/design-system';
import { formatNumber } from '@/lib/format';
import type { Category } from '@/types/budget';

export type CategoryTotal = { category: Category; amountDa: number };

type Props = { totals: CategoryTotal[]; totalDa: number };

const SIZE = 220;
const STROKE = 22;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const GAP = 4; // espace entre deux segments, en px le long du cercle
const DOT = 10;

// Anneau des dépenses par catégorie + légende (affichage seul, non cliquable).
export function CategoryChart({ totals, totalDa }: Props) {
  const { colors, spacing } = useTheme();
  const segments = totals.filter((t) => t.amountDa > 0);

  const lengths = segments.map((s) => (s.amountDa / totalDa) * CIRC);
  const arcs = segments.map(({ category }, i) => ({
    id: category.id,
    color: category.color,
    visible: Math.max(lengths[i] - (segments.length > 1 ? GAP : 0), 1),
    offset: lengths.slice(0, i).reduce((acc, l) => acc + l, 0),
  }));

  return (
    <Card radius="xl" padding="xl" gap="xl">
      <Box align="center" justify="center">
        <Svg width={SIZE} height={SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={colors.surfaceMuted}
            strokeWidth={STROKE}
            fill="none"
          />
          {arcs.map((a) => (
            <Circle
              key={a.id}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={a.color}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={`${a.visible} ${CIRC}`}
              strokeDashoffset={-a.offset}
            />
          ))}
        </Svg>
        <Stack align="center" gap="xxs" style={{ position: 'absolute' }}>
          <Text variant="caption" color="textSecondary">
            Dépensé
          </Text>
          <Row align="baseline" gap="xs">
            <Text variant="title" weight="extrabold" tabular>
              {formatNumber(totalDa)}
            </Text>
            <Text variant="bodySmall" weight="bold" color="textMuted">
              DA
            </Text>
          </Row>
          <Text variant="caption" color="textMuted">
            {segments.length} catégorie{segments.length > 1 ? 's' : ''}
          </Text>
        </Stack>
      </Box>

      <Stack
        gap="md"
        style={{ borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: spacing.lg }}
      >
        {segments.map(({ category, amountDa }) => (
          <Row key={category.id} justify="space-between" gap="md">
            <Row gap="sm" flex={1}>
              <Box
                radius="full"
                style={{ width: DOT, height: DOT, backgroundColor: category.color }}
              />
              <MaterialCommunityIcons
                name={category.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={16}
                color={colors.textSecondary}
              />
              <Text numberOfLines={1} style={{ flexShrink: 1 }}>
                {category.name}
              </Text>
            </Row>
            <Text variant="bodySmall" color="textSecondary" tabular>
              {formatNumber(amountDa)} DA
            </Text>
            <Text variant="body" weight="bold" tabular align="right" style={{ minWidth: 40 }}>
              {Math.round((amountDa / totalDa) * 100)}%
            </Text>
          </Row>
        ))}
      </Stack>
    </Card>
  );
}
