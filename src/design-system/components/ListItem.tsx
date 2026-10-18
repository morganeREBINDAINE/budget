import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Text } from '../primitives/Text';
import type { ThemeColor } from '../theme/light';
import { useTheme } from '../theme/ThemeProvider';
import { minTouchTarget } from '../tokens/spacing';

export type ListItemVariant = 'default' | 'danger';

export type ListItemProps = {
  label: string;
  description?: string;
  // Icône (ex. <MaterialCommunityIcons color={colors.primary} />) posée sur une pastille.
  icon?: ReactNode;
  // `none` : pas de pastille colorée derrière l'icône (l'icône a déjà son propre fond).
  iconBackground?: 'variant' | 'none';
  // Si la fonction renvoie une Promise : spinner à la place du chevron
  // et appuis ignorés jusqu'à sa résolution.
  onPress?: () => void | Promise<unknown>;
  variant?: ListItemVariant;
  // Chevron « › » à droite (défaut : affiché si `onPress`).
  showChevron?: boolean;
  disabled?: boolean;
};

const variants: Record<ListItemVariant, { iconBg: ThemeColor; fg: ThemeColor }> = {
  default: { iconBg: 'primarySoft', fg: 'text' },
  danger: { iconBg: 'dangerSoft', fg: 'danger' },
};

const ICON_SIZE = 40;

// Ligne d'action d'une liste courte (réglages, menu) : pastille d'icône, libellé, chevron.
export function ListItem({
  label,
  description,
  icon,
  iconBackground = 'variant',
  onPress,
  variant = 'default',
  showChevron,
  disabled = false,
}: ListItemProps) {
  const { colors, spacing, radius } = useTheme();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const v = variants[variant];
  const inactive = disabled || pending;

  const handlePress = async () => {
    // Garde : bloque les appuis répétés pendant une action asynchrone.
    if (inactive || inFlight.current || !onPress) return;
    const result = onPress();
    if (!(result instanceof Promise)) return;
    inFlight.current = true;
    setPending(true);
    try {
      await result;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: pending }}
      disabled={inactive || !onPress}
      onPress={handlePress}
      style={({ pressed }) => ({
        minHeight: minTouchTarget,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: pressed ? colors.surfaceMuted : colors.transparent,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      {icon ? (
        <View
          style={{
            width: ICON_SIZE,
            height: ICON_SIZE,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: iconBackground === 'none' ? colors.transparent : colors[v.iconBg],
          }}
        >
          {icon}
        </View>
      ) : null}
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text variant="body" weight="bold" color={v.fg}>
          {label}
        </Text>
        {description ? (
          <Text variant="bodySmall" color="textSecondary">
            {description}
          </Text>
        ) : null}
      </View>
      {pending ? (
        <ActivityIndicator color={colors[v.fg]} />
      ) : (showChevron ?? !!onPress) ? (
        <Text variant="title" color="textMuted">
          ›
        </Text>
      ) : null}
    </Pressable>
  );
}
