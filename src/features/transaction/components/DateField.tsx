import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable } from 'react-native';

import { minTouchTarget, Row, Stack, Text, useTheme } from '@/design-system';
import { formatShortDate, parseIsoDate, toIsoDate } from '@/lib/format';

type Props = {
  // YYYY-MM-DD
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
};

// Champ « Date » : ouvre le sélecteur natif (dialogue sur Android, calendrier en ligne sur iOS).
export function DateField({ value, onChange, label = 'Date', hint }: Props) {
  const { colors, radius, spacing } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const date = parseIsoDate(value);

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'date',
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) onChange(toIsoDate(selected));
        },
      });
    } else {
      setIosOpen((o) => !o);
    }
  };

  return (
    <Stack gap="xs">
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatShortDate(value)}`}
        style={({ pressed }) => ({
          minHeight: minTouchTarget,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          justifyContent: 'center',
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        })}
      >
        <Row gap="sm">
          <MaterialCommunityIcons
            name="calendar-blank-outline"
            size={20}
            color={colors.textSecondary}
          />
          <Text variant="body" weight="bold" color="textStrong" tabular>
            {formatShortDate(value)}
          </Text>
        </Row>
      </Pressable>
      {hint ? (
        <Text variant="bodySmall" color="textSecondary">
          {hint}
        </Text>
      ) : null}
      {Platform.OS === 'ios' && iosOpen && (
        <DateTimePicker
          value={date}
          mode="date"
          display="inline"
          accentColor={colors.primary}
          onChange={(_, selected) => {
            if (selected) onChange(toIsoDate(selected));
            setIosOpen(false);
          }}
        />
      )}
    </Stack>
  );
}
