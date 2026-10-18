import * as Haptics from 'expo-haptics';
import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { motion } from '@/design-system';
import type { YearMonth } from '@/lib/format';

// Distance (px) ou vélocité (px/s) à partir de laquelle on change de mois.
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 500;
// Le geste ne s'active qu'au-delà de ce déplacement horizontal,
// et échoue si le doigt part d'abord à la verticale (scroll de la liste).
const ACTIVE_OFFSET_X = 20;
const FAIL_OFFSET_Y = 15;

const easeOut = Easing.bezier(...motion.easing.decelerate);
const easeIn = Easing.bezier(...motion.easing.accelerate);

/**
 * Glissement horizontal pour passer d'un mois à l'autre :
 * le contenu suit le doigt, sort de l'écran, puis le nouveau mois arrive du côté opposé.
 * Glisser vers la gauche → mois suivant ; vers la droite → mois précédent.
 */
export function useMonthSwipe(month: YearMonth, onShift: (delta: 1 | -1) => void) {
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const animating = useSharedValue(false);
  // Direction du dernier changement déclenché par le geste, consommée à l'affichage du nouveau mois.
  const incoming = useSharedValue<1 | -1 | 0>(0);

  const commit = useCallback(
    (delta: 1 | -1) => {
      incoming.set(delta);
      Haptics.selectionAsync().catch(() => {});
      onShift(delta);
    },
    [onShift, incoming],
  );

  // Une fois le nouveau mois rendu, on le fait entrer depuis le côté opposé.
  useLayoutEffect(() => {
    const delta = incoming.get();
    if (delta === 0) return;
    incoming.set(0);
    translateX.set(delta * width);
    translateX.set(
      withTiming(0, { duration: motion.duration.base, easing: easeOut }, () => {
        animating.set(false);
      }),
    );
  }, [month, width, translateX, animating, incoming]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-ACTIVE_OFFSET_X, ACTIVE_OFFSET_X])
        .failOffsetY([-FAIL_OFFSET_Y, FAIL_OFFSET_Y])
        .onUpdate((e) => {
          if (animating.get()) return;
          translateX.set(e.translationX);
        })
        .onEnd((e) => {
          if (animating.get()) return;
          const passed =
            Math.abs(e.translationX) > SWIPE_DISTANCE || Math.abs(e.velocityX) > SWIPE_VELOCITY;
          // Le sens de la vélocité doit confirmer celui du déplacement (pas de lancer inverse).
          const sameDirection = e.translationX * e.velocityX >= 0;
          if (!passed || !sameDirection || e.translationX === 0) {
            translateX.set(withSpring(0));
            return;
          }
          const delta: 1 | -1 = e.translationX < 0 ? 1 : -1;
          animating.set(true);
          translateX.set(
            withTiming(
              -delta * width,
              { duration: motion.duration.fast, easing: easeIn },
              (finished) => {
                if (finished) scheduleOnRN(commit, delta);
                else animating.set(false);
              },
            ),
          );
        }),
    [width, commit, translateX, animating],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
  }));

  return { gesture, animatedStyle };
}
