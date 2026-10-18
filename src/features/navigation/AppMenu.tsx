import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';

import { minTouchTarget, Row, Stack, Text, useTheme } from '@/design-system';
import { AppLogo } from '@/features/brand/AppLogo';

type MainRoute = '/' | '/recurring' | '/debts' | '/account';

type Entry = {
  route: MainRoute;
  label: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
};

const ENTRIES: Entry[] = [
  { route: '/', label: 'Budget', icon: 'chart-donut' },
  { route: '/recurring', label: 'Paiements réguliers', icon: 'calendar-sync-outline' },
  { route: '/debts', label: 'Dettes', icon: 'handshake-outline' },
  { route: '/account', label: 'Mon compte', icon: 'account-circle-outline' },
];

// La pile reste [accueil] ou [accueil, écran du menu] : le retour Android ramène toujours à l'accueil.
function goTo(route: MainRoute, current: string) {
  if (route === current) return;
  if (route === '/') router.dismissTo('/');
  else if (current === '/') router.push(route);
  else router.replace(route);
}

type Props = { onNavigate: () => void };

export function AppMenu({ onNavigate }: Props) {
  const pathname = usePathname();
  return (
    <Stack padding="xl" gap="xxl">
      <Row gap="sm">
        <AppLogo />
        <Text variant="title">Budget</Text>
      </Row>
      <Stack gap="xs">
        {ENTRIES.map((entry) => (
          <MenuItem
            key={entry.route}
            entry={entry}
            active={pathname === entry.route}
            onPress={() => {
              onNavigate();
              goTo(entry.route, pathname);
            }}
          />
        ))}
      </Stack>
    </Stack>
  );
}

type MenuItemProps = { entry: Entry; active: boolean; onPress: () => void };

function MenuItem({ entry, active, onPress }: MenuItemProps) {
  const { colors, radius, spacing } = useTheme();
  const tint = active ? 'primary' : 'text';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        minHeight: minTouchTarget,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
        backgroundColor: active
          ? colors.primarySoft
          : pressed
            ? colors.surfaceMuted
            : colors.transparent,
      })}
    >
      <MaterialCommunityIcons name={entry.icon} size={22} color={colors[tint]} />
      <Text variant="heading" color={tint}>
        {entry.label}
      </Text>
    </Pressable>
  );
}
