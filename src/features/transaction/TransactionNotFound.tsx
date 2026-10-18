import { Button, Stack, Text, useSheet } from '@/design-system';

type Props = { title?: string; message?: string };

// Contenu d'une feuille dont l'élément n'existe plus (transaction, remboursement…).
export function TransactionNotFound({
  title = 'Transaction introuvable',
  message = 'Elle a peut-être été supprimée.',
}: Props) {
  const { close } = useSheet();
  return (
    <Stack flex={1} bg="surface" align="center" justify="center" gap="lg" padding="xl">
      <Text variant="title" align="center">
        {title}
      </Text>
      <Text variant="body" color="textSecondary" align="center">
        {message}
      </Text>
      <Button label="Fermer" variant="secondary" onPress={close} />
    </Stack>
  );
}
