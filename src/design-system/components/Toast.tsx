import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { Row } from '../primitives/Row';
import { Text } from '../primitives/Text';
import type { ThemeColor } from '../theme/light';
import { useTheme } from '../theme/ThemeProvider';
import { minTouchTarget } from '../tokens/spacing';

export type ToastVariant = 'error' | 'info';

export type ToastProps = {
  message: string;
  variant?: ToastVariant;
};

const variants: Record<
  ToastVariant,
  { bg: ThemeColor; icon: ComponentProps<typeof MaterialCommunityIcons>['name'] }
> = {
  error: { bg: 'danger', icon: 'alert-circle-outline' },
  info: { bg: 'neutralStrong', icon: 'information-outline' },
};

// Bandeau de message temporaire (visuel seul : affichage, durée et file gérés par l'appelant).
export function Toast({ message, variant = 'error' }: ToastProps) {
  const { colors } = useTheme();
  const v = variants[variant];
  return (
    <Row
      bg={v.bg}
      radius="lg"
      paddingX="lg"
      paddingY="md"
      gap="md"
      shadow="sm"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ minHeight: minTouchTarget }}
    >
      <MaterialCommunityIcons name={v.icon} size={22} color={colors.textOnColor} />
      <Text variant="body" color="textOnColor" style={{ flex: 1 }}>
        {message}
      </Text>
    </Row>
  );
}
