import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
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

export type SheetProps = {
  // Appelé une fois l'animation de fermeture terminée (ex. router.back()).
  onClose: () => void;
  // Part de la hauteur d'écran occupée par la feuille (défaut 2/3).
  heightRatio?: number;
  children: ReactNode;
};

type SheetContextValue = { close: () => void };

const SheetContext = createContext<SheetContextValue | null>(null);

// Ferme la feuille englobante en jouant l'animation de sortie.
export function useSheet(): SheetContextValue {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error('useSheet doit être utilisé dans un <Sheet>.');
  return ctx;
}

const DEFAULT_HEIGHT_RATIO = 2 / 3;

/**
 * Feuille modale qui monte du bas, sur un fond assombri.
 * Fermeture : toucher du fond, bouton retour Android, ou `useSheet().close()` (ex. une croix).
 * Pas de fermeture au glissement : le contenu défile librement.
 * À utiliser comme écran d'une route `presentation: 'transparentModal', animation: 'none'`.
 */
export function Sheet({ onClose, heightRatio = DEFAULT_HEIGHT_RATIO, children }: SheetProps) {
  const { colors, radius, motion } = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetHeight = Math.round(height * heightRatio);
  const progress = useSharedValue(0);
  const closing = useRef(false);

  useEffect(() => {
    progress.set(
      withTiming(1, {
        duration: motion.duration.base,
        easing: Easing.bezier(...motion.easing.decelerate),
      }),
    );
  }, [progress, motion]);

  const close = useCallback(() => {
    // Garde : un seul départ d'animation de fermeture.
    if (closing.current) return;
    closing.current = true;
    progress.set(
      withTiming(
        0,
        { duration: motion.duration.fast, easing: Easing.bezier(...motion.easing.accelerate) },
        (finished) => {
          if (finished) scheduleOnRN(onClose);
        },
      ),
    );
  }, [progress, motion, onClose]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.get(), [0, 1], [sheetHeight, 0]) }],
  }));

  return (
    <SheetContext.Provider value={{ close }}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop }, backdropStyle]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              paddingBottom: insets.bottom,
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
            },
            sheetStyle,
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </SheetContext.Provider>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
});
