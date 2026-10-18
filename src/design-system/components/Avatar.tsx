import { Row } from '../primitives/Row';
import { Text } from '../primitives/Text';
import type { ThemeColor } from '../theme/light';
import { useTheme } from '../theme/ThemeProvider';

export type AvatarSize = 'sm' | 'lg';
export type AvatarVariant = 'primary' | 'neutral';

export type AvatarProps = {
  // Initiales déjà calculées (ex. « YB »).
  initials: string;
  size?: AvatarSize;
  variant?: AvatarVariant;
};

const sizes: Record<AvatarSize, { box: number; text: 'heading' | 'title' }> = {
  sm: { box: 40, text: 'heading' },
  lg: { box: 56, text: 'title' },
};

const variants: Record<AvatarVariant, { bg: ThemeColor; fg: ThemeColor }> = {
  primary: { bg: 'primary', fg: 'onPrimary' },
  neutral: { bg: 'primarySoft', fg: 'primary' },
};

// Pastille ronde aux initiales (pas de photo : fonctionne hors ligne).
export function Avatar({ initials, size = 'sm', variant = 'primary' }: AvatarProps) {
  const { colors, radius } = useTheme();
  const s = sizes[size];
  const v = variants[variant];
  return (
    <Row
      justify="center"
      style={{
        width: s.box,
        height: s.box,
        borderRadius: radius.full,
        backgroundColor: colors[v.bg],
      }}
    >
      <Text variant={s.text} color={v.fg}>
        {initials}
      </Text>
    </Row>
  );
}
