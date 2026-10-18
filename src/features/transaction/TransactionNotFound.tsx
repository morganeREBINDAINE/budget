import { Button, Stack, Text } from '@/design-system';

import { closeSheet } from './closeSheet';

export function TransactionNotFound() {
  return (
    <Stack flex={1} bg="surface" align="center" justify="center" gap="lg" padding="xl">
      <Text variant="title" align="center">
        Transaction introuvable
      </Text>
      <Text variant="body" color="textSecondary" align="center">
        Elle a peut-être été supprimée.
      </Text>
      <Button label="Fermer" variant="secondary" onPress={closeSheet} />
    </Stack>
  );
}
