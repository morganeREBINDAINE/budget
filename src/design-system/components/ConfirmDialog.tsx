import { useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { Stack } from '../primitives/Stack';
import { Text } from '../primitives/Text';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // `danger` : action destructrice (bouton rouge).
  variant?: 'primary' | 'danger';
  // Si la fonction renvoie une Promise : spinner, fermeture bloquée jusqu'à sa résolution.
  onConfirm: () => void | Promise<unknown>;
  onCancel: () => void;
  // Message d'erreur à afficher (ex. échec de la requête), géré par l'appelant.
  error?: string | null;
  // Contenu additionnel entre le message et les boutons (ex. un champ date).
  children?: ReactNode;
};

/**
 * Modale de confirmation centrée sur un fond assombri.
 * Fermeture : « Annuler », toucher du fond ou bouton retour Android (sauf pendant la confirmation).
 * Avec un champ dans `children`, la carte remonte au-dessus du clavier.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'primary',
  onConfirm,
  onCancel,
  error,
  children,
}: ConfirmDialogProps) {
  const { colors, spacing } = useTheme();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const cancel = () => {
    if (inFlight.current) return;
    onCancel();
  };

  const confirm = async () => {
    // Garde : une seule confirmation à la fois.
    if (inFlight.current) return;
    const result = onConfirm();
    if (!(result instanceof Promise)) return;
    inFlight.current = true;
    setPending(true);
    try {
      await result;
    } catch {
      // L'appelant affiche l'erreur via `error`.
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={cancel}
    >
      <KeyboardAvoidingView
        behavior="padding"
        style={[styles.center, { backgroundColor: colors.backdrop, padding: spacing.xxl }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={cancel}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        />
        <Stack
          accessibilityViewIsModal
          bg="surface"
          padding="xxl"
          gap="lg"
          radius="xl"
          shadow="soft"
          style={{ alignSelf: 'stretch' }}
        >
          <Stack gap="sm">
            <Text variant="title">{title}</Text>
            {message ? (
              <Text variant="body" color="textSecondary">
                {message}
              </Text>
            ) : null}
          </Stack>
          {children}
          {error ? (
            <Text variant="bodySmall" color="danger" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <Stack gap="sm">
            <Button
              label={confirmLabel}
              variant={variant === 'danger' ? 'danger' : 'secondary'}
              loading={pending}
              onPress={confirm}
              fullWidth
            />
            <Button
              label={cancelLabel}
              variant="ghost"
              disabled={pending}
              onPress={cancel}
              fullWidth
            />
          </Stack>
        </Stack>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
