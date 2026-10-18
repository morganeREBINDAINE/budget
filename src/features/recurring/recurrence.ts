import { monthName } from '@/lib/format';
import type { RecurringFrequency, RecurringPayment } from '@/types/budget';

export const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  monthly: 'Mensuel',
  yearly: 'Annuel',
};

const dayLabel = (day: number) => (day === 1 ? '1er' : String(day));

// « Mensuel · le 5 », « Annuel · le 15 mars ».
export function formatRecurrence(
  p: Pick<RecurringPayment, 'frequency' | 'dayOfMonth' | 'month'>,
): string {
  const when =
    p.frequency === 'yearly' && p.month !== null
      ? `le ${dayLabel(p.dayOfMonth)} ${monthName(p.month)}`
      : `le ${dayLabel(p.dayOfMonth)}`;
  return `${FREQUENCY_LABEL[p.frequency]} · ${when}`;
}
