import { useState } from 'react';

import { Row, Skeleton, Stack, Text, useTheme } from '@/design-system';
import { LoadingRegion } from '@/features/sync/components/Skeletons';
import type { Transaction } from '@/types/budget';

import { TransactionForm } from './TransactionForm';
import { TransactionNotFound } from './TransactionNotFound';
import { useTransaction } from './useTransactions';

type Props = { id: string };

// Feuille de modification : lit la transaction dans SQLite avant d'afficher le formulaire.
export function TransactionSheetContent({ id }: Props) {
  const transaction = useTransaction(id);
  // Dernière version lue : après une suppression depuis la feuille, le formulaire reste affiché
  // pendant l'animation de fermeture au lieu de basculer sur « introuvable ».
  const [lastRead, setLastRead] = useState<Transaction | undefined>(undefined);
  const current = transaction.status === 'ready' ? transaction.data : undefined;
  if (current && current !== lastRead) setLastRead(current);
  const shown = current ?? lastRead;

  if (shown) {
    // Initialisé une seule fois (clé stable) : une synchro pendant la saisie ne l'écrase pas.
    return <TransactionForm key={shown.id} mode="edit" transaction={shown} />;
  }
  if (transaction.status === 'error') {
    return (
      <TransactionNotFound
        title="Transaction indisponible"
        message="Impossible de la lire sur le téléphone. Ferme puis rouvre l'application."
      />
    );
  }
  if (transaction.status === 'loading') return <TransactionFormSkeleton />;
  return <TransactionNotFound />;
}

// Formulaire pendant la lecture : mêmes blocs, valeurs remplacées.
function TransactionFormSkeleton() {
  const { spacing } = useTheme();
  return (
    <Stack
      flex={1}
      bg="surface"
      gap="lg"
      style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xxl }}
    >
      <Skeleton text="title" width="55%" />
      <LoadingRegion gap="lg">
        <Stack gap="xs">
          <Text variant="label" color="textSecondary">
            Montant
          </Text>
          <Skeleton height={64} radius="xl" />
        </Stack>
        <Row gap="md">
          <Stack flex={1} gap="xs">
            <Text variant="label" color="textSecondary">
              Date
            </Text>
            <Skeleton height={48} radius="md" />
          </Stack>
          <Stack flex={1} gap="xs">
            <Text variant="label" color="textSecondary">
              Note (optionnel)
            </Text>
            <Skeleton height={48} radius="md" />
          </Stack>
        </Row>
        <Skeleton height={56} radius="lg" />
      </LoadingRegion>
    </Stack>
  );
}
