import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { minTouchTarget, Row, Text, useTheme } from '@/design-system';
import { AppLogo } from '@/features/brand/AppLogo';

import { useMenu } from './MenuProvider';

type Props = {
  // Absent : pas de bouton d'export (ex. accueil, qui affiche la recherche à la place).
  onExport?: () => void;
  // Export en cours : spinner à la place de l'icône, bouton désactivé.
  exporting?: boolean;
  // Action propre à l'écran, à droite de l'export (ex. recherche de l'accueil).
  trailing?: ReactNode;
};

// Barre haute des écrans principaux : burger à gauche, logo centré, export (+ `trailing`) à droite.
export function AppHeader({ onExport, exporting = false, trailing }: Props) {
  const menu = useMenu();
  return (
    <Row justify="space-between" paddingY="sm">
      {/* Logo centré sur la largeur, quel que soit le nombre de boutons de chaque côté. */}
      <Row gap="sm" justify="center" style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
        <AppLogo />
        <Text variant="title">Budget</Text>
      </Row>
      <HeaderButton icon="menu" label="Ouvrir le menu" onPress={menu.open} />
      <Row gap="sm">
        {onExport && (
          <HeaderButton
            icon="tray-arrow-down"
            label="Exporter les données"
            onPress={onExport}
            loading={exporting}
          />
        )}
        {trailing}
      </Row>
    </Row>
  );
}

export type HeaderButtonProps = {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
  loading?: boolean;
  // `dark` : fond sombre (`neutralStrong`), icône blanche (ex. choix de la vue de l'accueil).
  variant?: 'default' | 'dark';
};

// Bouton rond de 48px de la barre haute (icône seule).
export function HeaderButton({
  icon,
  label,
  onPress,
  loading = false,
  variant = 'default',
}: HeaderButtonProps) {
  const { colors, radius, shadows } = useTheme();
  const dark = variant === 'dark';
  const background = dark
    ? { idle: colors.neutralStrong, pressed: colors.neutralStrongPressed }
    : { idle: colors.surface, pressed: colors.surfaceMuted };
  const iconColor = dark ? colors.textOnColor : colors.text;
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
        backgroundColor: pressed ? background.pressed : background.idle,
        borderWidth: 1,
        borderColor: dark ? colors.neutralStrong : colors.borderSubtle,
        ...shadows.xs,
      })}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
      )}
    </Pressable>
  );
}
