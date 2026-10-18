import { useState } from 'react';

import { ConfirmDialog } from '@/design-system';
import { DateField } from '@/features/transaction/components/DateField';
import { formatAmount, toIsoDate } from '@/lib/format';
import { fakeRequest } from '@/mocks/account';
import type { DuePayment } from '@/types/budget';

type Props = {
  // Échéance à confirmer ; null = modale fermée.
  due: DuePayment | null;
  onCancel: () => void;
  // Appelé après l'enregistrement réussi (l'encart disparaît).
  onPaid: (due: DuePayment) => void;
};

// Modale « J'ai payé » : date de paiement modifiable (aujourd'hui par défaut).
// À rendre avec une `key` par échéance pour repartir de la date du jour sans erreur.
export function PayDueDialog({ due, onCancel, onPaid }: Props) {
  const [paidAt, setPaidAt] = useState(() => toIsoDate(new Date()));
  const [error, setError] = useState<string | null>(null);

  // TODO(phase 3) : dépense + recurring_occurrences dans une même transaction SQLite.
  const confirm = async () => {
    if (!due) return;
    setError(null);
    try {
      await fakeRequest(600);
      onPaid(due);
    } catch {
      setError("L'enregistrement du paiement a échoué. Réessaie.");
    }
  };

  return (
    <ConfirmDialog
      visible={due !== null}
      title="Confirmer le paiement"
      message={
        due
          ? `Confirmer le paiement de ${due.payment.name} — ${formatAmount(due.payment.amountDa)} ? La dépense sera ajoutée à la date choisie.`
          : undefined
      }
      confirmLabel="Confirmer"
      onConfirm={confirm}
      onCancel={onCancel}
      error={error}
    >
      <DateField label="Date de paiement" value={paidAt} onChange={setPaidAt} />
    </ConfirmDialog>
  );
}
