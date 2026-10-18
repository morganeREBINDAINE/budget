import { SelectGrid, type SelectGridItem } from './SelectGrid';

type Props = {
  value: number | null;
  onChange: (day: number) => void;
  hint?: string;
  error?: string;
};

const DAYS: SelectGridItem[] = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
  accessibilityLabel: `Le ${i + 1}`,
}));

// Jour du mois 1–31 en grille de 7 colonnes.
export function DayOfMonthPicker(props: Props) {
  return <SelectGrid label="Jour du mois" items={DAYS} columns={7} {...props} />;
}
