import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '../theme/ThemeProvider';

export type DrawerProps = {
  open: boolean;
  // Demande de fermeture (fond touché, bouton retour Android).
  onClose: () => void;
  // Part de la largeur d'écran occupée par le panneau (défaut 0,8).
  widthRatio?: number;
  children: ReactNode;
};

const DEFAULT_WIDTH_RATIO = 0.8;

/**
 * Tiroir qui glisse depuis la gauche, sur un fond assombri.
 * Contrôlé par `open` ; reste monté le temps de l'animation de sortie.
 * Pas d'ouverture au glissement depuis le bord (évite le conflit avec les gestes horizontaux des écrans).
 */
export function Drawer({ open, onClose, widthRatio = DEFAULT_WIDTH_RATIO, children }: DrawerProps) {
  const { colors, radius, motion } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelWidth = Math.round(width * widthRatio);
  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(open);

  // Ajustement d'état pendant le rendu : monter le tiroir dès l'ouverture.
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) {
      progress.set(
        withTiming(1, {
          duration: motion.duration.base,
          easing: Easing.bezier(...motion.easing.decelerate),
        }),
      );
    } else {
      progress.set(
        withTiming(
          0,
          { duration: motion.duration.fast, easing: Easing.bezier(...motion.easing.accelerate) },
          (finished) => {
            if (finished) scheduleOnRN(setMounted, false);
          },
        ),
      );
    }
  }, [open, progress, motion]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.get(), [0, 1], [-panelWidth, 0]) }],
  }));

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop }, backdropStyle]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer le menu"
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.panel,
          {
            width: panelWidth,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            backgroundColor: colors.surface,
            borderTopRightRadius: radius.xxl,
            borderBottomRightRadius: radius.xxl,
          },
          panelStyle,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' },
});
