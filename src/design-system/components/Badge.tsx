import type { ReactNode } from 'react';

import { Row } from '../primitives/Row';
import { Text } from '../primitives/Text';
import type { ThemeColor } from '../theme/light';

export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'danger';

export type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  icon?: ReactNode;
};

const variants: Record<BadgeVariant, { bg: ThemeColor; fg: ThemeColor }> = {
  neutral: { bg: 'surfaceMuted', fg: 'textSecondary' },
  primary: { bg: 'primarySoft', fg: 'primary' },
  success: { bg: 'successSoft', fg: 'success' },
  danger: { bg: 'dangerSoft', fg: 'danger' },
};

// Pastille pilule (ex. « 66% » au centre du donut).
export function Badge({ label, variant = 'neutral', icon }: BadgeProps) {
  const v = variants[variant];
  return (
    <Row
      bg={v.bg}
      radius="full"
      paddingX="md"
      paddingY="xxs"
      gap="xs"
      style={{ alignSelf: 'flex-start' }}
    >
      {icon}
      <Text variant="caption" weight="bold" color={v.fg}>
        {label}
      </Text>
    </Row>
  );
}
