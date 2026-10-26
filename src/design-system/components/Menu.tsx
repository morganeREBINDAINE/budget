import { useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Stack } from '../primitives/Stack';
import { Text } from '../primitives/Text';
import { useTheme } from '../theme/ThemeProvider';
import { minTouchTarget } from '../tokens/spacing';

export type MenuItem<T extends string> = { value: T; label: string };

export type MenuProps<T extends string> = {
  items: MenuItem<T>[];
  // Option active (choix exclusif), en gras couleur primaire ; absente : aucune.
  value?: T;
  onSelect: (value: T) => void;
  // Déclencheur (ex. bouton icône) : appelle `open` au toucher.
  renderTrigger: (open: () => void) => ReactNode;
  // Libellé d'accessibilité de la liste d'options.
  label?: string;
};

const MIN_WIDTH = 200;

type Anchor = { top: number; right: number };

/**
 * Petit menu ancré sous son déclencheur, aligné sur son bord droit, sur un fond transparent.
 * Fermeture : choix d'une option, toucher en dehors ou bouton retour Android.
 */
export function Menu<T extends string>({
  items,
  value,
  onSelect,
  renderTrigger,
  label,
}: MenuProps<T>) {
  const { colors, radius, spacing } = useTheme();
  const { width } = useWindowDimensions();
  // Vue du déclencheur (ref de rappel), mesurée à l'ouverture pour ancrer le menu.
  const [trigger, setTrigger] = useState<View | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const open = () => {
    trigger?.measureInWindow((x, y, w, h) => {
      setAnchor({ top: y + h + spacing.xs, right: Math.max(spacing.sm, width - x - w) });
    });
  };
  const close = () => setAnchor(null);
  const select = (v: T) => {
    close();
    onSelect(v);
  };

  return (
    <>
      <View ref={setTrigger} collapsable={false}>
        {renderTrigger(open)}
      </View>
      <Modal
        visible={anchor !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={close}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Fermer le menu"
        />
        {anchor && (
          <Stack
            accessibilityRole="menu"
            accessibilityLabel={label}
            accessibilityViewIsModal
            bg="surface"
            radius="xl"
            shadow="soft"
            borderColor="borderSubtle"
            padding="xs"
            style={{
              position: 'absolute',
              top: anchor.top,
              right: anchor.right,
              minWidth: MIN_WIDTH,
            }}
          >
            {items.map((item) => {
              const checked = item.value === value;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => select(item.value)}
                  accessibilityRole="menuitem"
                  accessibilityState={{ checked }}
                  style={({ pressed }) => ({
                    minHeight: minTouchTarget,
                    justifyContent: 'center',
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: pressed ? colors.surfaceMuted : colors.transparent,
                  })}
                >
                  <Text
                    variant="body"
                    weight={checked ? 'bold' : 'semibold'}
                    color={checked ? 'primary' : 'text'}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </Stack>
        )}
      </Modal>
    </>
  );
}
