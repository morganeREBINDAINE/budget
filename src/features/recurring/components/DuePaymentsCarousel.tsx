import { memo, useCallback, useState } from 'react';
import {
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
} from 'react-native';
// FlatList de Gesture Handler : son défilement l'emporte sur le glissement de mois de l'accueil.
import { FlatList } from 'react-native-gesture-handler';

import { Row, screenPadding, Stack, Text, useTheme } from '@/design-system';
import type { DuePayment } from '@/types/budget';

import { DuePaymentBanner } from './DuePaymentBanner';

type Props = {
  // Échéances dues, de la plus ancienne à la plus récente.
  dues: DuePayment[];
  onPay: (due: DuePayment) => void;
};

const DOT_SIZE = 6;
// Au-delà, un compteur « 2 / 14 » remplace les points.
const MAX_DOTS = 8;

const keyOf = (d: DuePayment) => `${d.payment.id}-${d.dueDate}`;

// Encart unique des échéances dues : une échéance par page, défilement horizontal (virtualisé,
// le nombre d'échéances en retard peut grandir), indicateur de page sous l'encart.
export const DuePaymentsCarousel = memo(function DuePaymentsCarousel({ dues, onPay }: Props) {
  const { spacing } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const pageWidth = windowWidth - screenPadding * 2;
  const interval = pageWidth + spacing.md;
  const [index, setIndex] = useState(0);
  const current = Math.min(index, dues.length - 1);

  const renderItem: ListRenderItem<DuePayment> = useCallback(
    ({ item }) => (
      <Stack style={{ width: pageWidth }}>
        <DuePaymentBanner due={item} onPay={onPay} />
      </Stack>
    ),
    [pageWidth, onPay],
  );

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(e.nativeEvent.contentOffset.x / interval));

  return (
    <Stack gap="sm">
      <FlatList
        data={dues}
        keyExtractor={keyOf}
        renderItem={renderItem}
        horizontal
        scrollEnabled={dues.length > 1}
        snapToInterval={interval}
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={Separator}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({ length: interval, offset: interval * i, index: i })}
        initialNumToRender={2}
        windowSize={3}
      />
      {dues.length > 1 && <PageIndicator count={dues.length} current={current} />}
    </Stack>
  );
});

function PageIndicator({ count, current }: { count: number; current: number }) {
  const { colors, radius } = useTheme();
  const label = `Échéance ${current + 1} sur ${count}`;
  if (count > MAX_DOTS) {
    return (
      <Text variant="caption" color="textSecondary" align="center" accessibilityLabel={label}>
        {current + 1} / {count}
      </Text>
    );
  }
  return (
    <Row gap="xs" justify="center" accessible accessibilityLabel={label}>
      {Array.from({ length: count }, (_, i) => (
        <Stack
          key={i}
          style={{
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: radius.full,
            backgroundColor: i === current ? colors.danger : colors.border,
          }}
        />
      ))}
    </Row>
  );
}

function Separator() {
  const { spacing } = useTheme();
  return <Stack style={{ width: spacing.md }} />;
}
