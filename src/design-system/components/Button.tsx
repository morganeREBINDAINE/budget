import { useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Text } from '../primitives/Text';
import type { Theme, ThemeColor } from '../theme/light';
import { useTheme } from '../theme/ThemeProvider';
import { minTouchTarget } from '../tokens/spacing';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'onPress' | 'children' | 'style'> & {
  label: string;
  // Si la fonction renvoie une Promise, le bouton affiche un spinner
  // et ignore les appuis jusqu'à sa résolution.
  onPress?: () => void | Promise<unknown>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

type VariantStyle = { bg: ThemeColor; bgPressed: ThemeColor; fg: ThemeColor; border?: ThemeColor };

const variants: Record<ButtonVariant, VariantStyle> = {
  primary: { bg: 'success', bgPressed: 'successStrong', fg: 'textOnColor' },
  secondary: { bg: 'neutralStrong', bgPressed: 'neutralStrongPressed', fg: 'textOnColor' },
  outline: { bg: 'surface', bgPressed: 'background', fg: 'textStrong', border: 'border' },
  ghost: { bg: 'transparent', bgPressed: 'surfaceMuted', fg: 'textStrong' },
};

const sizes = (theme: Theme) =>
  ({
    sm: { minHeight: 40, paddingHorizontal: theme.spacing.md },
    md: { minHeight: minTouchTarget, paddingHorizontal: theme.spacing.lg },
    lg: { minHeight: 56, paddingHorizontal: theme.spacing.xxl },
  }) as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const v = variants[variant];
  const busy = loading || pending;
  const inactive = disabled || busy;

  const handlePress = async () => {
    // Garde : bloque les appuis répétés même si `disabled` n'est pas encore appliqué.
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
      accessibilityState={{ disabled: inactive, busy }}
      hitSlop={size === 'sm' ? 4 : undefined}
      disabled={inactive}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        sizes(theme)[size],
        {
          borderRadius: theme.radius.lg,
          gap: theme.spacing.sm,
          backgroundColor: theme.colors[pressed ? v.bgPressed : v.bg],
          borderColor: v.border ? theme.colors[v.border] : theme.colors.transparent,
          transform: [{ scale: pressed ? theme.motion.pressScale : 1 }],
          opacity: disabled ? 0.5 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
      {...rest}
    >
      {busy ? (
        <ActivityIndicator color={theme.colors[v.fg]} />
      ) : (
        <>
          {leftIcon}
          <Text variant="body" weight="bold" color={v.fg}>
            {label}
          </Text>
          {rightIcon}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  fullWidth: { alignSelf: 'stretch' },
});
