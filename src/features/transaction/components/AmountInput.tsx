import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput } from 'react-native';

import { Row, Stack, Text, useTheme } from '@/design-system';
import { editAmountInput } from '@/lib/money';
import type { Currency } from '@/types/budget';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  currency: Currency;
  // Absent : devise fixe, le suffixe n'est pas touchable (ex. paiements réguliers en DA).
  onToggleCurrency?: () => void;
  error?: string;
};

const CURRENCY_LABEL: Record<Currency, string> = { DZD: 'DA', EUR: '€' };

// Grand champ « Montant » ; le suffixe DA / € bascule la devise si `onToggleCurrency` est fourni.
// La saisie est groupée par 3 chiffres pendant la frappe (« 10 000 »), curseur gardé en place.
export function AmountInput({ value, onChangeText, currency, onToggleCurrency, error }: Props) {
  const { colors, radius, spacing, typography } = useTheme();
  const other = currency === 'DZD' ? 'EUR' : 'DZD';
  // Fin de la sélection native, pour situer la frappe suivante.
  const selectionEnd = useRef(value.length);
  // Curseur imposé après un reformatage, relâché à l'image suivante pour laisser l'utilisateur
  // le déplacer.
  const [caret, setCaret] = useState<number | null>(null);

  useEffect(() => {
    if (caret === null) return;
    const frame = requestAnimationFrame(() => setCaret(null));
    return () => cancelAnimationFrame(frame);
  }, [caret]);

  const handleChangeText = (next: string) => {
    const edit = editAmountInput(value, next, selectionEnd.current);
    selectionEnd.current = edit.caret;
    if (edit.text !== next) setCaret(edit.caret);
    onChangeText(edit.text);
  };

  return (
    <Stack gap="xs">
      <Text variant="label" color="textSecondary">
        Montant
      </Text>
      <Row
        gap="sm"
        bg="background"
        radius="xl"
        paddingX="lg"
        paddingY="md"
        style={{ borderWidth: 1, borderColor: error ? colors.danger : colors.transparent }}
      >
        <TextInput
          value={value}
          onChangeText={handleChangeText}
          onSelectionChange={(e) => {
            selectionEnd.current = e.nativeEvent.selection.end;
          }}
          selection={caret === null ? undefined : { start: caret, end: caret }}
          keyboardType={currency === 'EUR' ? 'decimal-pad' : 'number-pad'}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Montant"
          style={[
            typography.display,
            { flex: 1, padding: 0, color: colors.textStrong, fontVariant: ['tabular-nums'] },
          ]}
        />
        {onToggleCurrency ? (
          <Pressable
            onPress={onToggleCurrency}
            accessibilityRole="button"
            accessibilityLabel={`Devise ${CURRENCY_LABEL[currency]}, passer en ${CURRENCY_LABEL[other]}`}
            hitSlop={spacing.sm}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radius.md,
              backgroundColor: pressed ? colors.border : colors.surfaceMuted,
            })}
          >
            <Text variant="title" color="textSecondary">
              {CURRENCY_LABEL[currency]}
            </Text>
          </Pressable>
        ) : (
          <Text variant="title" color="textSecondary" style={{ paddingHorizontal: spacing.md }}>
            {CURRENCY_LABEL[currency]}
          </Text>
        )}
      </Row>
      {error ? (
        <Text variant="bodySmall" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
