import type { MenuItem } from '@/design-system';
import { formatMonth, formatYearWindow, type YearMonth } from '@/lib/format';

// Vue de l'accueil : un mois (carrousel glissable) ou les 12 mois finissant au mois affiché (fixe).
export type HomeView = 'month' | 'year';

export const HOME_VIEW_ITEMS: MenuItem<HomeView>[] = [
  { value: 'month', label: 'Vue par mois' },
  { value: 'year', label: "Vue à l'année" },
];

// Libellés propres à la période affichée : bilan et liste « Détail ».
export function periodLabels(
  view: HomeView,
  month: YearMonth,
): { balance: string; detail: string } {
  return view === 'year'
    ? { balance: 'Reste sur 12 mois', detail: formatYearWindow(month) }
    : { balance: 'Reste ce mois-ci', detail: formatMonth(month) };
}
