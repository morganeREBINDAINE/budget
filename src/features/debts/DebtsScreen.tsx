import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, SectionList, type SectionListRenderItem } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Card,
  Fab,
  FAB_AREA_HEIGHT,
  minTouchTarget,
  Row,
  screenPadding,
  SegmentedControl,
  Stack,
  Text,
  useTheme,
} from '@/design-system';
import { AppHeader } from '@/features/navigation/AppHeader';
import { formatAmount } from '@/lib/format';
import type { DebtDirection } from '@/types/budget';

import { DebtRow } from './components/DebtRow';
import { DIRECTION_OPTIONS } from './direction';
import { useDebts, type DebtItem } from './useDebts';

type SectionKey = 'active' | 'settled';
type Section = { key: SectionKey; data: DebtItem[]; count: number };

const openDebt = (id: string) => router.push({ pathname: '/debts/[id]', params: { id } });
// TODO(phase 7) : export JSON.
const exportData = () => {};

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

// Écran principal (menu burger) : onglets Je dois / On me doit, total restant, liste virtualisée.
export function DebtsScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [direction, setDirection] = useState<DebtDirection>('owed_to_me');
  const [settledOpen, setSettledOpen] = useState(false);
  const { active, settled, totalRemainingDa } = useDebts(direction);

  const sections: Section[] = [
    { key: 'active', data: active, count: active.length },
    ...(settled.length > 0
      ? [{ key: 'settled' as const, data: settledOpen ? settled : [], count: settled.length }]
      : []),
  ];

  const renderItem: SectionListRenderItem<DebtItem, Section> = useCallback(
    ({ item }) => <DebtRow item={item} onPress={openDebt} />,
    [],
  );

  const addDebt = () => router.push({ pathname: '/debts/new', params: { direction } });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack gap="lg" style={{ paddingHorizontal: screenPadding }}>
        <AppHeader onExport={exportData} />
        <SegmentedControl options={DIRECTION_OPTIONS} value={direction} onChange={setDirection} />
      </Stack>
      <SectionList
        sections={sections}
        keyExtractor={(i) => i.debt.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <TotalRemaining direction={direction} amountDa={totalRemainingDa} count={active.length} />
        }
        renderSectionHeader={({ section }) =>
          section.key === 'settled' ? (
            <SettledHeader
              count={section.count}
              open={settledOpen}
              onToggle={() => setSettledOpen((o) => !o)}
            />
          ) : null
        }
        renderSectionFooter={({ section }) =>
          section.key === 'active' && section.count === 0 ? (
            <EmptyDebts direction={direction} />
          ) : null
        }
        ItemSeparatorComponent={Separator}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{
          paddingHorizontal: screenPadding,
          paddingTop: spacing.lg,
          paddingBottom: FAB_AREA_HEIGHT + insets.bottom + spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      />
      <Fab
        icon="plus"
        label={
          direction === 'i_owe' ? 'Ajouter une dette que je dois' : 'Ajouter une dette à recevoir'
        }
        onPress={addDebt}
        style={{ position: 'absolute', right: screenPadding, bottom: insets.bottom + spacing.xl }}
      />
    </SafeAreaView>
  );
}

type TotalProps = { direction: DebtDirection; amountDa: number; count: number };

function TotalRemaining({ direction, amountDa, count }: TotalProps) {
  const { spacing } = useTheme();
  const owe = direction === 'i_owe';
  return (
    <Card radius="xl" gap="xs" style={{ marginBottom: spacing.lg }}>
      <Text variant="label" color="textSecondary">
        {owe ? 'Reste à payer' : 'Reste à recevoir'}
      </Text>
      <Text variant="display" color={owe ? 'danger' : 'success'} tabular>
        {formatAmount(amountDa)}
      </Text>
      <Text variant="bodySmall" color="textSecondary">
        {count === 0 ? 'Aucune dette en cours' : `${plural(count, 'dette')} en cours`}
      </Text>
    </Card>
  );
}

type SettledHeaderProps = { count: number; open: boolean; onToggle: () => void };

// Titre de la partie repliable « Dettes soldées ».
function SettledHeader({ count, open, onToggle }: SettledHeaderProps) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`Dettes soldées, ${count}, ${open ? 'replier' : 'déplier'}`}
      style={{ minHeight: minTouchTarget, justifyContent: 'center', marginTop: spacing.xl }}
    >
      <Row justify="space-between">
        <Row gap="sm" align="baseline">
          <Text variant="title">Dettes soldées</Text>
          <Text variant="body" color="textMuted">
            {count}
          </Text>
        </Row>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={colors.textSecondary}
        />
      </Row>
      {open ? <Stack style={{ height: spacing.md }} /> : null}
    </Pressable>
  );
}

function EmptyDebts({ direction }: { direction: DebtDirection }) {
  const { colors } = useTheme();
  return (
    <Card radius="xl" padding="xxl" align="center" gap="sm" variant="flat">
      <MaterialCommunityIcons name="handshake-outline" size={36} color={colors.textMuted} />
      <Text variant="heading">Aucune dette en cours</Text>
      <Text variant="bodySmall" color="textSecondary" align="center">
        {direction === 'i_owe'
          ? 'Ajoute ce que tu dois avec « + ».'
          : 'Ajoute ce qu’on te doit avec « + ».'}
      </Text>
    </Card>
  );
}

function Separator() {
  const { spacing } = useTheme();
  return <Stack style={{ height: spacing.md }} />;
}
