import { Avatar, Card, Row, Stack, Text } from '@/design-system';
import { initials } from '@/lib/format';

type Props = { name: string; email: string };

// Profil Google : initiales (pas de photo, fonctionne hors ligne), nom, email.
export function ProfileCard({ name, email }: Props) {
  return (
    <Card>
      <Row gap="lg">
        <Avatar initials={initials(name)} size="lg" />
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
