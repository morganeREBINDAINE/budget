import type { DebtDirection } from '@/types/budget';

export const DIRECTION_LABEL: Record<DebtDirection, string> = {
  i_owe: 'Je dois',
  owed_to_me: 'On me doit',
};

export const DIRECTION_OPTIONS = (['i_owe', 'owed_to_me'] as const).map((value) => ({
  value,
  label: DIRECTION_LABEL[value],
}));

export const parseDirection = (value: string | undefined): DebtDirection =>
  value === 'owed_to_me' ? 'owed_to_me' : 'i_owe';
