import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Row } from '../primitives/Row';
import { Text } from '../primitives/Text';
import { useTheme } from '../theme/ThemeProvider';
import { minTouchTarget } from '../tokens/spacing';

export type ScreenHeaderProps = {
  title: string;
  onBack: () => void;
  backLabel?: string;
  // Action facultative à droite (bouton rond de 48px conseillé).
  right?: ReactNode;
};

// Barre haute des écrans secondaires : retour à gauche, titre centré, action à droite.
export function ScreenHeader({ title, onBack, backLabel = 'Retour', right }: ScreenHeaderProps) {
  const { colors, radius, shadows } = useTheme();
  return (
    <Row justify="space-between" gap="sm" paddingY="sm">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
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
        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
      </Pressable>
      <Text variant="title" align="center" numberOfLines={1} style={{ flex: 1 }}>
        {title}
      </Text>
      <View style={{ width: minTouchTarget, alignItems: 'center' }}>{right}</View>
    </Row>
  );
}
