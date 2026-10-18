import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';

import { Card, Input, minTouchTarget, Row, Stack, Text, useTheme } from '@/design-system';
import type { DebtPerson } from '@/types/budget';

type Props = {
  value: string;
  onChange: (value: string) => void;
  people: DebtPerson[];
  error?: string;
};

const MAX_SUGGESTIONS = 5;
export const PERSON_NAME_MAX_LENGTH = 40;

// Diacritiques combinants (U+0300–U+036F) laissés par la décomposition NFD.
const DIACRITICS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g',
);

// Comparaison insensible à la casse et aux accents.
export const normalizeName = (s: string) =>
  s.trim().normalize('NFD').replace(DIACRITICS, '').toLowerCase();

// Champ « Personne » avec autocomplétion des noms enregistrés (5 suggestions au plus).
export function PersonField({ value, onChange, people, error }: Props) {
  const { colors, radius, spacing } = useTheme();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const query = normalizeName(value);

  const exactMatch = useMemo(
    () => people.some((p) => normalizeName(p.name) === query),
    [people, query],
  );
  const suggestions = useMemo(() => {
    if (query === '') return [];
    return people
      .filter((p) => normalizeName(p.name).includes(query) && normalizeName(p.name) !== query)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .slice(0, MAX_SUGGESTIONS);
  }, [people, query]);

  const hint =
    query !== '' && !exactMatch && !error
      ? `Nouveau contact : « ${value.trim()} » sera enregistré.`
      : undefined;

  return (
    <Stack gap="xs">
      <Input
        label="Personne"
        value={value}
        onChangeText={(v) => {
          onChange(v);
          setShowSuggestions(true);
        }}
        placeholder="Ex. Karim"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={PERSON_NAME_MAX_LENGTH}
        returnKeyType="done"
        leftIcon={
          <MaterialCommunityIcons name="account-outline" size={20} color={colors.textSecondary} />
        }
        hint={hint}
        error={error}
      />
      {showSuggestions && suggestions.length > 0 && (
        <Card padding="xs" accessibilityRole="list">
          {suggestions.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => {
                onChange(p.name);
                setShowSuggestions(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Choisir ${p.name}`}
              style={({ pressed }) => ({
                minHeight: minTouchTarget,
                justifyContent: 'center',
                paddingHorizontal: spacing.md,
                borderRadius: radius.sm,
                backgroundColor: pressed ? colors.surfaceMuted : colors.transparent,
              })}
            >
              <Row gap="sm">
                <MaterialCommunityIcons name="history" size={18} color={colors.textMuted} />
                <Text variant="body" weight="semibold" numberOfLines={1}>
                  {p.name}
                </Text>
              </Row>
            </Pressable>
          ))}
        </Card>
      )}
    </Stack>
  );
}
