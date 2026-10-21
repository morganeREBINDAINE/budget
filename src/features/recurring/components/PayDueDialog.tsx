import { useRef, useState } from 'react';

import { ConfirmDialog } from '@/design-system';
import { useDatabase } from '@/db/DatabaseProvider';
import { useUserId } from '@/features/auth/AuthProvider';
import { DateField } from '@/features/transaction/components/DateField';
import { formatAmount, toIsoDate } from '@/lib/format';
import { AlreadyPaidError, payDue } from '@/repositories/recurring';
import { RowNotFoundError } from '@/repositories/write';
import type { DuePayment } from '@/types/budget';

type Props = {
  // Échéance à confirmer ; null = modale fermée.
  due: DuePayment | null;
  onCancel: () => void;
  // Appelé après l'enregistrement réussi (l'encart disparaît de lui-même : lecture en direct).
  onPaid: () => void;
};

// Modale « J'ai payé » : date de paiement modifiable (aujourd'hui par défaut, jamais dans le futur).
// À rendre avec une `key` par échéance pour repartir de la date du jour sans erreur.
export function PayDueDialog({ due, onCancel, onPaid }: Props) {
  const db = useDatabase();
  const userId = useUserId();
  const today = toIsoDate(new Date());
  const [paidAt, setPaidAt] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const paying = useRef(false);

  // Écriture SQLite synchrone (dépense + occurrence) : pas de spinner, garde contre le double appui.
  const confirm = () => {
    if (!due || paying.current) return;
    if (paidAt > today) {
      setError('La date de paiement ne peut pas être dans le futur.');
      return;
    }
    paying.current = true;
    setError(null);
    try {
      payDue(db, userId, { paymentId: due.payment.id, dueDate: due.dueDate }, paidAt);
      onPaid();
    } catch (e) {
      // Déjà payée (ex. depuis un autre appareil) : le résultat attendu est atteint.
      if (e instanceof AlreadyPaidError) {
        onPaid();
        return;
      }
      console.error("[db] Échec de l'enregistrement du paiement", e);
      setError(
        e instanceof RowNotFoundError
          ? "Ce paiement régulier n'existe plus."
          : "L'enregistrement du paiement a échoué. Réessaie.",
      );
    } finally {
      paying.current = false;
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
      <DateField
        label="Date de paiement"
        value={paidAt}
        onChange={(d) => {
          setPaidAt(d);
          setError(null);
        }}
        maximumDate={today}
      />
    </ConfirmDialog>
  );
}
