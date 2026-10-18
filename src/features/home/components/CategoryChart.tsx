import { useState } from 'react';
import { type LayoutChangeEvent } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Box, Card, Row, Stack, Text, useTheme } from '@/design-system';
import { formatNumber } from '@/lib/format';
import type { Category } from '@/types/budget';

export type CategoryTotal = { category: Category; amountDa: number };

type Props = { totals: CategoryTotal[]; totalDa: number };

const MAX_SIZE = 340;
const STROKE = 30;
const LABEL_SPACE = 34; // marge autour de l'anneau pour les pourcentages
const GAP = 3; // espace entre deux segments, en px le long du cercle
const MIN_LABEL_PERCENT = 3; // en dessous, pas d'étiquette (chevauchements)
const LABEL_WIDTH = 44;
const DOT = 10;

// Anneau des dépenses par catégorie, % autour de l'anneau, légende couleur + nom.
// Les segments suivent l'ordre des catégories (position), donc l'ordre de l'arc-en-ciel.
export function CategoryChart({ totals, totalDa }: Props) {
  const { colors, spacing } = useTheme();
  const [width, setWidth] = useState(0);

  const segments = totals
    .filter((t) => t.amountDa > 0)
    .sort((a, b) => a.category.position - b.category.position);

  const size = Math.min(width, MAX_SIZE);
  const r = size / 2 - LABEL_SPACE - STROKE / 2;
  const circ = 2 * Math.PI * r;
  const center = size / 2;

  const fractions = segments.map((s) => s.amountDa / totalDa);
  const starts = fractions.map((_, i) => fractions.slice(0, i).reduce((acc, f) => acc + f, 0));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <Card radius="xl" padding="lg" gap="lg">
      <Box align="center" justify="center" onLayout={onLayout} style={{ height: size || MAX_SIZE }}>
        {size > 0 && (
          <>
            <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
              {segments.map(({ category }, i) => (
                <Circle
                  key={category.id}
                  cx={center}
                  cy={center}
                  r={r}
                  stroke={category.color}
                  strokeWidth={STROKE}
                  fill="none"
                  strokeDasharray={`${Math.max(fractions[i] * circ - (segments.length > 1 ? GAP : 0), 1)} ${circ}`}
                  strokeDashoffset={-starts[i] * circ}
                />
              ))}
            </Svg>

            {segments.map(({ category }, i) => {
              const percent = Math.round(fractions[i] * 100);
              if (percent < MIN_LABEL_PERCENT) return null;
              const angle = (starts[i] + fractions[i] / 2) * 2 * Math.PI - Math.PI / 2;
              const labelR = r + STROKE / 2 + LABEL_SPACE / 2;
              return (
                <Text
                  key={category.id}
                  variant="body"
                  weight="extrabold"
                  align="center"
                  tabular
                  style={{
                    position: 'absolute',
                    width: LABEL_WIDTH,
                    left: center + labelR * Math.cos(angle) - LABEL_WIDTH / 2,
                    top: center + labelR * Math.sin(angle) - spacing.sm - spacing.xxs,
                    color: category.color,
                  }}
                >
                  {percent}%
                </Text>
              );
            })}

            <Stack align="center" gap="xxs" style={{ position: 'absolute' }}>
              <Text variant="bodySmall" weight="semibold" color="textSecondary">
                Dépensé
              </Text>
              <Row align="baseline" gap="xs">
                <Text variant="display" tabular>
                  {formatNumber(totalDa)}
                </Text>
                <Text variant="body" weight="bold" color="textMuted">
                  DA
                </Text>
              </Row>
            </Stack>
          </>
        )}
      </Box>

      <Row
        wrap
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.borderSubtle,
          paddingTop: spacing.lg,
          rowGap: spacing.md,
        }}
      >
        {segments.map(({ category }) => (
          <Row key={category.id} gap="sm" style={{ width: '33.33%', paddingRight: spacing.xs }}>
            <Box
              radius="full"
              style={{ width: DOT, height: DOT, backgroundColor: category.color }}
            />
            <Text variant="bodySmall" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
              {category.name}
            </Text>
          </Row>
        ))}
      </Row>
    </Card>
  );
}
