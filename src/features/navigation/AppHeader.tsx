import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { minTouchTarget, Row, Text, useTheme } from '@/design-system';
import { AppLogo } from '@/features/brand/AppLogo';

import { useMenu } from './MenuProvider';

type Props = {
  onExport: () => void;
  // Export en cours : spinner à la place de l'icône, bouton désactivé.
  exporting?: boolean;
};

// Barre haute des écrans principaux : burger à gauche, logo centré, export à droite.
export function AppHeader({ onExport, exporting = false }: Props) {
  const menu = useMenu();
  return (
    <Row justify="space-between" paddingY="sm">
      <HeaderButton icon="menu" label="Ouvrir le menu" onPress={menu.open} />
      <Row gap="sm">
        <AppLogo />
        <Text variant="title">Budget</Text>
      </Row>
      <HeaderButton
        icon="tray-arrow-down"
        label="Exporter les données"
        onPress={onExport}
        loading={exporting}
      />
    </Row>
  );
}

type HeaderButtonProps = {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
  loading?: boolean;
};

function HeaderButton({ icon, label, onPress, loading = false }: HeaderButtonProps) {
  const { colors, radius, shadows } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled: loading }}
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
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <MaterialCommunityIcons name={icon} size={22} color={colors.text} />
      )}
    </Pressable>
  );
}
