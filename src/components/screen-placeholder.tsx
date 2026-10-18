import { Link, type Href } from 'expo-router';
import { ScrollView } from 'react-native';

import { Button, Text, useTheme } from '@/design-system';

type Props = {
  title: string;
  links?: { label: string; href: Href }[];
};

// Écran vide temporaire (phase 1) : titre + liens pour parcourir la navigation.
export function ScreenPlaceholder({ title, links = [] }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: spacing.xxl,
        gap: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      <Text variant="title">{title}</Text>
      {links.map((link) => (
        <Link key={link.label} href={link.href} asChild>
          <Button label={link.label} variant="secondary" />
        </Link>
      ))}
    </ScrollView>
  );
}
