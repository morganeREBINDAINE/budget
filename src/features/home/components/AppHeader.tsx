import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { minTouchTarget, Row, Text, useTheme } from '@/design-system';

type Props = { onExport: () => void };

const LOGO_SIZE = 36;

// Barre haute : logo centré, bouton d'export à droite.
export function AppHeader({ onExport }: Props) {
  const { colors, radius, shadows } = useTheme();
  return (
    <Row justify="space-between" paddingY="sm">
      <Row style={{ width: minTouchTarget }} />
      <Row gap="sm">
        <Row
          justify="center"
          style={{
            width: LOGO_SIZE,
            height: LOGO_SIZE,
            borderRadius: radius.md,
            backgroundColor: colors.primary,
            ...shadows.float,
          }}
        >
          <MaterialCommunityIcons name="wallet-outline" size={20} color={colors.onPrimary} />
        </Row>
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
