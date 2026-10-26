import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Row, Stack, Text, useTheme } from '@/design-system';
import { formatAmount, formatShortDate } from '@/lib/format';
import type { Transaction } from '@/types/budget';

// `eurRate` : montants en euros arrondis à ce taux (vue « Voir en euro »).
type Props = { expenses: Transaction[]; eurRate?: number | null };

// Lignes affichées au plus (le reste est résumé) : la liste n'est pas virtualisée.
const MAX_VISIBLE = 10;

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/**
 * Encart d'erreur fixe sous le graphique : dépenses dont la catégorie est introuvable
 * (données incohérentes). Comptées dans le total des dépenses, absentes du graphique.
 * Volontairement non masquable : sert au diagnostic.
 */
export function OrphanExpensesNotice({ expenses, eurRate = null }: Props) {
  const { colors, spacing } = useTheme();
  const visible = expenses.slice(0, MAX_VISIBLE);
  const hidden = expenses.length - visible.length;

  return (
    <Stack
      radius="xl"
      padding="lg"
      gap="md"
      bg="dangerSoft"
      borderColor="danger"
      accessibilityRole="alert"
    >
      <Row gap="sm" align="flex-start">
        <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.danger} />
        <Stack flex={1} gap="xxs">
          <Text variant="heading" color="danger">
            {plural(expenses.length, 'dépense')} sans catégorie
          </Text>
          <Text variant="bodySmall" color="textSecondary">
            Leur catégorie est introuvable. Elles sont comptées dans le total des dépenses mais pas
            dans le graphique.
          </Text>
        </Stack>
      </Row>
      <Stack
        gap="sm"
        style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }}
      >
        {visible.map((t) => (
          <Stack key={t.id} gap="xxs">
            <Row gap="sm">
              <Text variant="bodySmall" weight="bold" tabular>
                {formatShortDate(t.date)}
              </Text>
              <Text variant="bodySmall" numberOfLines={1} style={{ flex: 1 }}>
                {t.note ?? 'Sans note'}
              </Text>
              <Text variant="bodySmall" weight="bold" tabular>
                {formatAmount(t.amountDa, { eurRate })}
              </Text>
            </Row>
            <Text variant="caption" color="textMuted" numberOfLines={1} selectable>
              catégorie : {t.categoryId ?? 'aucune'} · id : {t.id}
            </Text>
          </Stack>
        ))}
        {hidden > 0 && (
          <Text variant="bodySmall" color="textSecondary">
            et {plural(hidden, 'autre')}
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
