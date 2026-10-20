import { useEffect } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';
import type { RadiusToken } from '../tokens/radius';
import type { TypographyVariant } from '../tokens/typography';

export type SkeletonProps = {
  // Largeur en px ou en % (défaut 100 %).
  width?: DimensionValue;
  // Hauteur en px ; ignorée si `text` est fourni.
  height?: number;
  // Ligne de texte factice : hauteur de la police de la variante, centrée dans sa hauteur de ligne.
  text?: TypographyVariant;
  // Cercle de diamètre `size` (pastille, avatar).
  circle?: number;
  radius?: RadiusToken;
  style?: StyleProp<ViewStyle>;
};

const MIN_OPACITY = 0.45;

/**
 * Bloc gris pulsant qui remplace une donnée pendant son chargement (montant, ligne de liste,
 * graphique). Masqué aux lecteurs d'écran : le conteneur annonce le chargement. Pulsation coupée si
 * l'utilisateur a réduit les animations.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  text,
  circle,
  radius = 'sm',
  style,
}: SkeletonProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withRepeat(
      withTiming(MIN_OPACITY, {
        duration: theme.motion.duration.slow * 2,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [opacity, reducedMotion, theme.motion.duration.slow]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const typo = text ? theme.typography[text] : undefined;
  const size: ViewStyle = circle
    ? { width: circle, height: circle, borderRadius: theme.radius.full }
    : {
        width,
        height: typo ? typo.fontSize : height,
        marginVertical: typo ? (typo.lineHeight - typo.fontSize) / 2 : 0,
        borderRadius: theme.radius[radius],
      };

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ backgroundColor: theme.colors.surfaceMuted }, size, animatedStyle, style]}
    />
  );
}
