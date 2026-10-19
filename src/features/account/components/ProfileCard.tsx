import { Avatar, Card, Row, Stack, Text } from '@/design-system';
import { initials } from '@/lib/format';

type Props = { name: string | null; email: string | null };

// Profil du compte connecté : initiales (pas de photo, fonctionne hors ligne), nom, email.
// Sans nom Google, l'email prend la place du nom.
export function ProfileCard({ name, email }: Props) {
  const title = name?.trim() || email || 'Compte Google';
  const subtitle = name?.trim() ? email : null;
  return (
    <Card>
      <Row gap="lg">
        <Avatar initials={initials(title)} size="lg" />
        <Stack flex={1} gap="xxs">
          <Text variant="heading" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </Stack>
      </Row>
    </Card>
  );
}
