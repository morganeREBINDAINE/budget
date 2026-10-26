import { memo } from 'react';

import { HomeSkeleton } from './components/HomeSkeleton';
import { PeriodContent, type PeriodPageProps } from './MonthPage';
import { useYearSummary } from './useMonthSummary';

// Vue à l'année : 12 mois finissant à `month`, page fixe (pas de glissement) ; skeletons au premier
// chargement, bloc d'erreur si la lecture locale échoue.
export const YearPage = memo(function YearPage({ categories, ...rest }: PeriodPageProps) {
  const summary = useYearSummary(rest.month, categories);
  if (summary.status === 'loading') return <HomeSkeleton month={rest.month} view="year" />;
  if (summary.status === 'error') return <HomeSkeleton month={rest.month} view="year" readError />;
  return <PeriodContent view="year" summary={summary.data} {...rest} />;
});
