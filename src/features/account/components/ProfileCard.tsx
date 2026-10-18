import { Card, Row, Stack, Text, useTheme } from '@/design-system';
import { initials } from '@/lib/format';

type Props = { name: string; email: string };

const AVATAR_SIZE = 56;

// Profil Google : initiales (pas de photo, fonctionne hors ligne), nom, email.
export function ProfileCard({ name, email }: Props) {
  const { colors, radius } = useTheme();
  return (
    <Card>
      <Row gap="lg">
        <Row
          justify="center"
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: radius.full,
            backgroundColor: colors.primary,
          }}
        >
          <Text variant="title" color="onPrimary">
            {initials(name)}
          </Text>
        </Row>
        <Stack flex={1} gap="xxs">
          <Text variant="heading" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
            {email}
          </Text>
        </Stack>
      </Row>
    </Card>
  );
}
