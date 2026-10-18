import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { motion } from '@/design-system';
import { shiftMonth, type YearMonth } from '@/lib/format';

type Props = {
  month: YearMonth;
  onChange: (month: YearMonth) => void;
  renderPage: (month: YearMonth) => ReactNode;
};

// Distance (part de la largeur) ou vélocité (px/s) à partir de laquelle on passe au mois voisin.
const SWIPE_RATIO = 0.2;
const SWIPE_VELOCITY = 500;
// Le geste ne s'active qu'au-delà de ce déplacement horizontal,
// et échoue si le doigt part d'abord à la verticale (défilement de la liste).
const ACTIVE_OFFSET_X = 15;
const FAIL_OFFSET_Y = 15;

const easeOut = Easing.bezier(...motion.easing.decelerate);
const monthIndex = ({ year, month }: YearMonth) => year * 12 + month - 1;

/**
 * Carrousel horizontal des mois : le mois précédent et le suivant sont rendus de part et d'autre,
 * ils apparaissent pendant le glissement et le mois se cale au relâchement.
 * Les pages sont positionnées par rapport au mois d'origine (pas de « reset » visible au changement).
 * Glisser vers la gauche → mois suivant ; vers la droite → mois précédent.
 */
export function MonthPager({ month, onChange, renderPage }: Props) {
  const { width } = useWindowDimensions();
  // Mois d'origine : les positions sont relatives à lui pour garder des translations petites.
  const [origin] = useState(() => monthIndex(month));
  const page = monthIndex(month) - origin;

  const translateX = useSharedValue(-page * width);
  const committedPage = useSharedValue(page);
  const dragStart = useSharedValue(0);

  // Changement de mois (geste terminé ou flèches) : on glisse jusqu'à la page si besoin.
  useEffect(() => {
    committedPage.set(page);
    if (translateX.get() !== -page * width) {
      translateX.set(
        withTiming(-page * width, { duration: motion.duration.base, easing: easeOut }),
      );
    }
  }, [page, width, translateX, committedPage]);

  const commit = useCallback(
    (delta: number) => {
      Haptics.selectionAsync().catch(() => {});
      onChange(shiftMonth(month, delta));
    },
    [month, onChange],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-ACTIVE_OFFSET_X, ACTIVE_OFFSET_X])
        .failOffsetY([-FAIL_OFFSET_Y, FAIL_OFFSET_Y])
        .onStart(() => {
          cancelAnimation(translateX);
          dragStart.set(translateX.get());
        })
        .onUpdate((e) => {
          translateX.set(dragStart.get() + e.translationX);
        })
        .onEnd((e) => {
          const base = -committedPage.get() * width;
          const offset = translateX.get() - base;
          let delta = 0;
          if (offset < -width * SWIPE_RATIO || e.velocityX < -SWIPE_VELOCITY) delta = 1;
          else if (offset > width * SWIPE_RATIO || e.velocityX > SWIPE_VELOCITY) delta = -1;
          // Le sens de la vélocité doit confirmer celui du déplacement (pas de lancer inverse).
          if (delta !== 0 && offset * delta > 0) delta = 0;
          const target = base - delta * width;
          translateX.set(
            withTiming(target, { duration: motion.duration.base, easing: easeOut }, (finished) => {
              if (finished && delta !== 0) scheduleOnRN(commit, delta);
            }),
          );
        }),
    [width, commit, translateX, committedPage, dragStart],
  );

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
  }));

  const pages = [page - 1, page, page + 1];

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.viewport}>
        <Animated.View style={[StyleSheet.absoluteFill, trackStyle]}>
          {pages.map((p) => (
            <View key={p} style={[styles.page, { left: p * width, width }]}>
              {renderPage(shiftMonth(month, p - page))}
            </View>
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  page: { position: 'absolute', top: 0, bottom: 0 },
});
