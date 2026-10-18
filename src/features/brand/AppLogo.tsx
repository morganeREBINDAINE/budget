import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Row, useTheme } from '@/design-system';

type Props = { size?: number };

// Logo de l'app : portefeuille blanc sur pastille indigo.
export function AppLogo({ size = 36 }: Props) {
  const { colors, radius, shadows } = useTheme();
  return (
    <Row
      justify="center"
      style={{
        width: size,
        height: size,
        borderRadius: size >= 64 ? radius.xl : radius.md,
        backgroundColor: colors.primary,
        ...shadows.float,
      }}
    >
      <MaterialCommunityIcons
        name="wallet-outline"
        size={Math.round(size * 0.55)}
        color={colors.onPrimary}
      />
    </Row>
  );
}
