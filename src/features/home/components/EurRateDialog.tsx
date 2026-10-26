import { useState } from 'react';

import { ConfirmDialog, Input, Text } from '@/design-system';
import { useDatabase } from '@/db/DatabaseProvider';
import { useUserId } from '@/features/auth/AuthProvider';
import { readLastEurRate } from '@/features/transaction/lastEurRate';
import { parseDecimal, toDecimalInput } from '@/lib/money';

type Props = {
  visible: boolean;
  onCancel: () => void;
  // Taux validé (> 0) : l'accueil affiche le mois en euros, rien n'est enregistré.
  onConfirm: (rate: number) => void;
};

// Modale « Voir en euro » : taux du jour prérempli avec le dernier taux saisi (lecture seule,
// jamais mémorisé ici). À rendre avec une `key` par ouverture pour repartir du dernier taux.
export function EurRateDialog({ visible, onCancel, onConfirm }: Props) {
  const db = useDatabase();
  const userId = useUserId();
  const [rate, setRate] = useState(() => {
    const last = readLastEurRate(db, userId);
    return last === null ? '' : toDecimalInput(last);
  });
  const [error, setError] = useState<string | null>(null);

  // Calcul local et synchrone : pas de spinner, la modale se ferme aussitôt.
  const confirm = () => {
    const value = parseDecimal(rate);
    if (value === null || value <= 0) {
      setError('Saisis un taux supérieur à 0.');
      return;
    }
    onConfirm(value);
  };

  return (
    <ConfirmDialog
      visible={visible}
      title="Voir en euro"
      message="Les montants du mois seront convertis au taux du jour, arrondis à l'euro. C'est indicatif : rien n'est enregistré."
      confirmLabel="Convertir"
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <Input
        label="Taux du jour"
        value={rate}
        onChangeText={(value) => {
          setRate(value);
          setError(null);
        }}
        keyboardType="decimal-pad"
        placeholder="Ex. 250"
        autoFocus
        returnKeyType="done"
        onSubmitEditing={confirm}
        rightIcon={
          <Text variant="bodySmall" color="textMuted">
            DA / €
          </Text>
        }
        error={error ?? undefined}
      />
    </ConfirmDialog>
  );
}
