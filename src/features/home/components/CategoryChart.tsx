import { useState } from 'react';
import { type LayoutChangeEvent, Pressable } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Box, Card, Row, Stack, Text, useTheme } from '@/design-system';
import { displayAmount, formatNumber } from '@/lib/format';
import type { CategoryTotal } from '@/lib/budget';

// `totalDa` : total affiché au centre (toutes les dépenses du mois, y compris celles sans
// catégorie valide) ; les pourcentages portent sur la somme des segments.
// `eurRate` : total affiché en euros arrondis à ce taux (vue « Voir en euro »).
type Props = { totals: CategoryTotal[]; totalDa: number; eurRate?: number | null };

const MAX_SIZE = 340;
const STROKE = 30;
const LABEL_SPACE = 34; // marge autour de l'anneau pour les pourcentages
const GAP = 4; // espace entre deux segments, en px le long du cercle
const CORNER = 6; // rayon des coins arrondis des segments
const DIMMED_OPACITY = 0.3; // segments et légende non touchés pendant un appui
const LABEL_WIDTH = 44;
const DOT = 10;

// Secteur d'anneau [a0, a1] (radians) aux coins arrondis.
function roundedArc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const ro = r + STROKE / 2;
  const ri = r - STROKE / 2;
  const c = Math.min(CORNER, ((a1 - a0) * ri) / 2, STROKE / 2);
  const p = (rad: number, a: number) => `${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`;
  const dO = c / ro;
  const dI = c / ri;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M ${p(ro - c, a0)}`,
    `Q ${p(ro, a0)} ${p(ro, a0 + dO)}`,
    `A ${ro} ${ro} 0 ${large} 1 ${p(ro, a1 - dO)}`,
    `Q ${p(ro, a1)} ${p(ro - c, a1)}`,
    `L ${p(ri + c, a1)}`,
    `Q ${p(ri, a1)} ${p(ri, a1 - dI)}`,
    `A ${ri} ${ri} 0 ${large} 0 ${p(ri, a0 + dI)}`,
    `Q ${p(ri, a0)} ${p(ri + c, a0)}`,
    'Z',
  ].join(' ');
}

// Anneau des dépenses par catégorie, % autour de l'anneau, légende couleur + nom.
// Les segments suivent l'ordre des catégories (position), donc l'ordre de l'arc-en-ciel.
export function CategoryChart({ totals, totalDa, eurRate = null }: Props) {
  const { colors, spacing } = useTheme();
  const [width, setWidth] = useState(0);
  // Catégorie sous le doigt : surbrillance uniquement pendant l'appui.
  const [pressedId, setPressedId] = useState<string | null>(null);
  const pressHandlers = (id: string) => ({
    onPressIn: () => setPressedId(id),
    onPressOut: () => setPressedId(null),
  });
  const opacityOf = (id: string) => (pressedId && pressedId !== id ? DIMMED_OPACITY : 1);

  const segments = totals
    .filter((t) => t.amountDa > 0)
    .sort((a, b) => a.category.position - b.category.position);

  const total = displayAmount(totalDa, eurRate);
  const size = Math.min(width, MAX_SIZE);
  const r = size / 2 - LABEL_SPACE - STROKE / 2;
  const center = size / 2;

  const segmentsTotal = segments.reduce((acc, s) => acc + s.amountDa, 0);
  const fractions = segments.map((s) => s.amountDa / segmentsTotal);
  const starts = fractions.map((_, i) => fractions.slice(0, i).reduce((acc, f) => acc + f, 0));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <Card radius="xl" padding="lg" gap="lg">
      <Box align="center" justify="center" onLayout={onLayout} style={{ height: size || MAX_SIZE }}>
        {size > 0 && (
          <>
            <Svg width={size} height={size}>
              {segments.length === 1 ? (
                <Circle
                  cx={center}
                  cy={center}
                  r={r}
                  stroke={segments[0].category.color}
                  strokeWidth={STROKE}
                  fill="none"
                  {...pressHandlers(segments[0].category.id)}
                />
              ) : (
                segments.map(({ category }, i) => {
                  const gap = GAP / r / 2;
                  const a0 = starts[i] * 2 * Math.PI - Math.PI / 2 + gap;
                  const a1 = (starts[i] + fractions[i]) * 2 * Math.PI - Math.PI / 2 - gap;
                  return (
                    <Path
                      key={category.id}
                      d={roundedArc(center, center, r, a0, Math.max(a1, a0 + 0.01))}
                      fill={category.color}
                      opacity={opacityOf(category.id)}
                      {...pressHandlers(category.id)}
                    />
                  );
                })
              )}
            </Svg>

            {segments.map(({ category }, i) => {
              const percent = Math.round(fractions[i] * 100);
              const angle = (starts[i] + fractions[i] / 2) * 2 * Math.PI - Math.PI / 2;
              const labelR = r + STROKE / 2 + LABEL_SPACE / 2;
              return (
                <Pressable
                  key={category.id}
                  {...pressHandlers(category.id)}
                  style={{
                    position: 'absolute',
                    width: LABEL_WIDTH,
                    left: center + labelR * Math.cos(angle) - LABEL_WIDTH / 2,
                    top: center + labelR * Math.sin(angle) - spacing.sm - spacing.xxs,
                    opacity: opacityOf(category.id),
                  }}
                >
                  <Text
                    variant="body"
                    weight="extrabold"
                    align="center"
                    tabular
                    style={{ color: category.color }}
                  >
                    {percent < 1 ? '<1' : percent}%
                  </Text>
                </Pressable>
              );
            })}

            <Stack align="center" gap="xxs" style={{ position: 'absolute' }}>
              <Text variant="bodySmall" weight="semibold" color="textSecondary">
                Dépensé
              </Text>
              <Row align="baseline" gap="xs">
                <Text variant="display" tabular>
                  {formatNumber(total.value)}
                </Text>
                <Text variant="body" weight="bold" color="textMuted">
                  {total.unit}
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
        {segments.map(({ category }) => {
          const pressed = pressedId === category.id;
          return (
            <Row
              key={category.id}
              gap="sm"
              style={{
                width: '33.33%',
                paddingRight: spacing.xs,
                opacity: opacityOf(category.id),
              }}
            >
              <Box
                radius="full"
                style={{ width: DOT, height: DOT, backgroundColor: category.color }}
              />
              <Text
                variant="bodySmall"
                weight={pressed ? 'extrabold' : 'semibold'}
                numberOfLines={1}
                style={[{ flexShrink: 1 }, pressed && { color: category.color }]}
              >
                {category.name}
              </Text>
            </Row>
          );
        })}
      </Row>
    </Card>
  );
}
