import { useEffect, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FAB_AREA_HEIGHT, screenPadding, Toast, useTheme } from '@/design-system';
import { getCurrentToast, subscribeToasts, TOAST_ENTER_MS, TOAST_EXIT_MS } from '@/lib/toast';

/**
 * Affiche le toast global en bas de l'écran, au-dessus des boutons flottants (ou du clavier).
 * Monté une seule fois à la racine, par-dessus toute la navigation ; ne bloque pas les touchers.
 */
export function ToastHost() {
  const toast = useSyncExternalStore(subscribeToasts, getCurrentToast);
  const { spacing, motion } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useReanimatedKeyboardAnimation();
  const progress = useSharedValue(0);
  const bottom = insets.bottom + FAB_AREA_HEIGHT;

  const id = toast?.id;
  const phase = toast?.phase;
  useEffect(() => {
    if (phase === 'visible') {
      progress.set(0);
      progress.set(
        withTiming(1, {
          duration: TOAST_ENTER_MS,
          easing: Easing.bezier(...motion.easing.decelerate),
        }),
      );
    } else if (phase === 'leaving') {
      progress.set(
        withTiming(0, {
          duration: TOAST_EXIT_MS,
          easing: Easing.bezier(...motion.easing.accelerate),
        }),
      );
    }
  }, [id, phase, progress, motion]);

  const animatedStyle = useAnimatedStyle(() => {
    // Clavier ouvert (hauteur négative) : le toast remonte juste au-dessus.
    const aboveKeyboard = Math.min(0, keyboard.height.get() + bottom - spacing.lg);
    return {
      opacity: progress.get(),
      transform: [
        { translateY: aboveKeyboard + interpolate(progress.get(), [0, 1], [spacing.lg, 0]) },
      ],
    };
  });

  if (!toast) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          { position: 'absolute', left: screenPadding, right: screenPadding, bottom },
          animatedStyle,
        ]}
      >
        <Toast message={toast.message} variant={toast.variant} />
      </Animated.View>
    </View>
  );
}
