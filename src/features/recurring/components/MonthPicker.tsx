import { monthName } from '@/lib/format';

import { SelectGrid, type SelectGridItem } from './SelectGrid';

type Props = {
  value: number | null;
  onChange: (month: number) => void;
  error?: string;
};

const MONTH_ITEMS: SelectGridItem[] = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: monthName(i + 1, { short: true }),
  accessibilityLabel: monthName(i + 1),
}));

// Mois de l'échéance annuelle, grille 4 × 3.
export function MonthPicker(props: Props) {
  return <SelectGrid label="Mois" items={MONTH_ITEMS} columns={4} {...props} />;
}
