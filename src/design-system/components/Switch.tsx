import { Pressable, Switch as RNSwitch } from 'react-native';

import { Row } from '../primitives/Row';
import { Stack } from '../primitives/Stack';
import { Text } from '../primitives/Text';
import { useTheme } from '../theme/ThemeProvider';
import { minTouchTarget } from '../tokens/spacing';

export type SwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  // Avec `label` : ligne complète touchable (libellé + description à gauche, interrupteur à droite).
  label?: string;
  description?: string;
  disabled?: boolean;
};

// Interrupteur oui / non aux couleurs du thème.
export function Switch({
  value,
  onValueChange,
  label,
  description,
  disabled = false,
}: SwitchProps) {
  const { colors } = useTheme();
  const control = (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: colors.border, true: colors.success }}
      thumbColor={colors.surface}
      ios_backgroundColor={colors.border}
      accessibilityLabel={label}
    />
  );
  if (!label) return control;
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      style={{ minHeight: minTouchTarget, justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
    >
      <Row gap="md">
        <Stack flex={1} gap="xxs">
          <Text variant="heading">{label}</Text>
          {description ? (
            <Text variant="bodySmall" color="textSecondary">
              {description}
            </Text>
          ) : null}
        </Stack>
        {control}
      </Row>
    </Pressable>
  );
}
