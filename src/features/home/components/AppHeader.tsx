import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { minTouchTarget, Row, Text, useTheme } from '@/design-system';
import { AppLogo } from '@/features/brand/AppLogo';

type Props = { onExport: () => void };

// Barre haute : logo centré, bouton d'export à droite.
export function AppHeader({ onExport }: Props) {
  const { colors, radius, shadows } = useTheme();
  return (
    <Row justify="space-between" paddingY="sm">
      <Row style={{ width: minTouchTarget }} />
      <Row gap="sm">
        <AppLogo />
        <Text variant="title">Budget</Text>
      </Row>
      <Pressable
        onPress={onExport}
        accessibilityRole="button"
        accessibilityLabel="Exporter les données"
        style={({ pressed }) => ({
          width: minTouchTarget,
          height: minTouchTarget,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          ...shadows.xs,
        })}
      >
        <MaterialCommunityIcons name="tray-arrow-down" size={22} color={colors.text} />
      </Pressable>
    </Row>
  );
}
