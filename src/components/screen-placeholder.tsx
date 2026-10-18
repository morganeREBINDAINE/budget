import { Link, type Href } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { colors, fonts, fontSizes, radius, spacing } from '@/theme';

type Props = {
  title: string;
  links?: { label: string; href: Href }[];
};

// Écran vide temporaire (phase 1) : titre + liens pour parcourir la navigation.
export function ScreenPlaceholder({ title, links = [] }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {links.map((link) => (
        <Link key={link.label} href={link.href} style={styles.link}>
          {link.label}
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.text },
  link: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.onPrimary,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
    overflow: 'hidden',
  },
});
