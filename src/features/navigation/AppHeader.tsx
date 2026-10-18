import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';

import { minTouchTarget, Row, Text, useTheme } from '@/design-system';
import { AppLogo } from '@/features/brand/AppLogo';

import { useMenu } from './MenuProvider';

type Props = { onExport: () => void };

// Barre haute des écrans principaux : burger à gauche, logo centré, export à droite.
export function AppHeader({ onExport }: Props) {
  const menu = useMenu();
  return (
    <Row justify="space-between" paddingY="sm">
      <HeaderButton icon="menu" label="Ouvrir le menu" onPress={menu.open} />
      <Row gap="sm">
        <AppLogo />
        <Text variant="title">Budget</Text>
      </Row>
      <HeaderButton icon="tray-arrow-down" label="Exporter les données" onPress={onExport} />
    </Row>
  );
}

type HeaderButtonProps = {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
};

function HeaderButton({ icon, label, onPress }: HeaderButtonProps) {
  const { colors, radius, shadows } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
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
      <MaterialCommunityIcons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}
