import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fab, Row, useTheme } from '@/design-system';

type Props = { onAddIncome: () => void; onAddExpense: () => void };

// Boutons flottants « − » (dépense) et « + » (entrée), centrés en bas de l'écran.
export function FabGroup({ onAddIncome, onAddExpense }: Props) {
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Row
      justify="center"
      gap="xxl"
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + spacing.xl }}
    >
      <Fab icon="minus" label="Ajouter une dépense" variant="neutral" onPress={onAddExpense} />
      <Fab icon="plus" label="Ajouter une entrée" variant="accent" onPress={onAddIncome} />
    </Row>
  );
}
