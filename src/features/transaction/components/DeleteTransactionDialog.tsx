import { useRef, useState } from 'react';

import { ConfirmDialog } from '@/design-system';
import { useDatabase } from '@/db/DatabaseProvider';
import { useUserId } from '@/features/auth/AuthProvider';
import { formatAmount } from '@/lib/format';
import { deleteTransaction } from '@/repositories/transactions';
import { RowNotFoundError } from '@/repositories/write';
import type { Transaction } from '@/types/budget';

type Props = {
  // Transaction à supprimer ; null : modale fermée.
  transaction: Transaction | null;
  onCancel: () => void;
  onDeleted: () => void;
};

// Confirmation puis suppression logique d'une transaction (appui long sur une ligne, feuille).
// À rendre avec `key` = id de la transaction pour repartir sans erreur à chaque ouverture.
export function DeleteTransactionDialog({ transaction, onCancel, onDeleted }: Props) {
  const db = useDatabase();
  const userId = useUserId();
  const [error, setError] = useState<string | null>(null);
  const deleting = useRef(false);

  // Écriture SQLite synchrone : pas de spinner, garde contre le double appui.
  const confirm = () => {
    if (!transaction || deleting.current) return;
    deleting.current = true;
    try {
      deleteTransaction(db, userId, transaction.id);
      onDeleted();
    } catch (e) {
      // Déjà supprimée (ex. par une synchro) : le résultat attendu est atteint.
      if (e instanceof RowNotFoundError) {
        onDeleted();
        return;
      }
      console.error('[db] Échec de la suppression de la transaction', e);
      setError('La suppression a échoué. Réessaie.');
    } finally {
      deleting.current = false;
    }
  };

  const isIncome = transaction?.type === 'income';
  const label = transaction?.note ?? (isIncome ? 'Entrée' : 'Dépense');

  return (
    <ConfirmDialog
      visible={transaction !== null}
      variant="danger"
      title={isIncome ? 'Supprimer cette entrée ?' : 'Supprimer cette dépense ?'}
      message={
        transaction
          ? `« ${label} » — ${formatAmount(transaction.amountDa)}. Cette action est définitive.`
          : undefined
      }
      confirmLabel="Supprimer"
      onConfirm={confirm}
      onCancel={onCancel}
      error={error}
    />
  );
}
