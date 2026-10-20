import type { ReactNode } from 'react';

import { Card, Row, Skeleton, Stack, type StackProps } from '@/design-system';

// Compositions de skeletons partagées par les écrans pendant le pull initial.

/** Zone en chargement : annoncée une seule fois aux lecteurs d'écran. */
export function LoadingRegion({ children, ...rest }: StackProps & { children: ReactNode }) {
  return (
    <Stack
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement des données"
      {...rest}
    >
      {children}
    </Stack>
  );
}

/** Ligne de liste en carte (transaction, paiement régulier, dette) : tuile, deux lignes, montant. */
export function RowSkeleton() {
  return (
    <Card padding="lg" radius="xl">
      <Row gap="md">
        <Skeleton width={48} height={48} radius="md" />
        <Stack flex={1} gap="xxs">
          <Skeleton text="heading" width="60%" />
          <Skeleton text="bodySmall" width="40%" />
        </Stack>
        <Skeleton text="heading" width={72} />
      </Row>
    </Card>
  );
}

/** Plusieurs lignes de liste espacées. */
export function RowSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <Stack gap="md">
      {Array.from({ length: count }, (_, i) => (
        <RowSkeleton key={i} />
      ))}
    </Stack>
  );
}
