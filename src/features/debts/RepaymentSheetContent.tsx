import { useState } from 'react';

import { Skeleton, Stack, Text, useTheme } from '@/design-system';
import { LoadingRegion } from '@/features/sync/components/Skeletons';
import { TransactionNotFound } from '@/features/transaction/TransactionNotFound';
import type { DebtRepayment } from '@/types/budget';

import { RepaymentForm } from './RepaymentForm';
import { useDebt, useDebtPeople, useDebtRepayments, useRepayment } from './useDebts';

const READ_ERROR = {
  title: 'Remboursement indisponible',
  message: "Impossible de lire la dette sur le téléphone. Ferme puis rouvre l'application.",
};

/** Feuille « Nouveau remboursement » d'une dette. */
export function NewRepaymentSheetContent({ debtId }: { debtId: string }) {
  return <RepaymentContent debtId={debtId} repayment={undefined} />;
}

/** Feuille de modification : lit le remboursement, puis sa dette. */
export function EditRepaymentSheetContent({ id }: { id: string }) {
  const repayment = useRepayment(id);
  // Dernière version lue : après une suppression depuis la feuille, le formulaire reste affiché
  // pendant l'animation de fermeture au lieu de basculer sur « introuvable ».
  const [lastRead, setLastRead] = useState<DebtRepayment | undefined>(undefined);
  const current = repayment.status === 'ready' ? repayment.data : undefined;
  if (current && current !== lastRead) setLastRead(current);
  const shown = current ?? lastRead;

  if (shown) return <RepaymentContent debtId={shown.debtId} repayment={shown} />;
  if (repayment.status === 'error') return <TransactionNotFound {...READ_ERROR} />;
  if (repayment.status === 'loading') return <RepaymentFormSkeleton />;
  return (
    <TransactionNotFound title="Remboursement introuvable" message="Il a peut-être été supprimé." />
  );
}

function RepaymentContent({
  debtId,
  repayment,
}: {
  debtId: string;
  repayment: DebtRepayment | undefined;
}) {
  const debt = useDebt(debtId);
  const repayments = useDebtRepayments(debtId);
  const people = useDebtPeople();

  if (debt.status === 'error' || repayments.status === 'error' || people.status === 'error') {
    return <TransactionNotFound {...READ_ERROR} />;
  }
  if (debt.status === 'loading' || repayments.status === 'loading' || people.status === 'loading') {
    return <RepaymentFormSkeleton />;
  }
  if (!debt.data) {
    return (
      <TransactionNotFound title="Dette introuvable" message="Elle a peut-être été supprimée." />
    );
  }
  const personName = people.data.find((p) => p.id === debt.data?.personId)?.name;
  const repaidDa = repayments.data.reduce((acc, r) => acc + r.amountDa, 0);
  // Champs initialisés une seule fois (clé stable) ; le reste dû autorisé reste à jour.
  return (
    <RepaymentForm
      key={repayment?.id ?? 'new'}
      debt={debt.data}
      personName={personName}
      repaidDa={repaidDa}
      repayment={repayment}
    />
  );
}

// Formulaire pendant la lecture : mêmes blocs, valeurs remplacées.
function RepaymentFormSkeleton() {
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
        <Skeleton height={64} radius="lg" />
        <Stack gap="xs">
          <Text variant="label" color="textSecondary">
            Montant
          </Text>
          <Skeleton height={64} radius="xl" />
        </Stack>
        <Skeleton height={56} radius="lg" />
      </LoadingRegion>
    </Stack>
  );
}
