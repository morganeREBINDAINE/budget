import { View } from 'react-native';

import { useTheme, type ThemeColor } from '@/design-system';

type Props = {
  // 0 → 1
  progress: number;
  color?: ThemeColor;
};

const HEIGHT = 6;

// Barre de progression du remboursement.
export function ProgressBar({ progress, color = 'success' }: Props) {
  const { colors, radius } = useTheme();
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{
        height: HEIGHT,
        borderRadius: radius.full,
        backgroundColor: colors.surfaceMuted,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: HEIGHT,
          borderRadius: radius.full,
          backgroundColor: colors[color],
        }}
      />
    </View>
  );
}
