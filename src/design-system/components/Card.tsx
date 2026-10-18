import { Box, type BoxProps } from '../primitives/Box';

export type CardVariant = 'elevated' | 'flat';

export type CardProps = Omit<BoxProps, 'bg' | 'shadow' | 'borderColor'> & {
  variant?: CardVariant;
};

// Surface blanche, bordure subtile ; `elevated` ajoute l'ombre douce de la maquette.
export function Card({ variant = 'elevated', padding = 'lg', radius = 'lg', ...rest }: CardProps) {
  return (
    <Box
      bg="surface"
      borderColor="borderSubtle"
      shadow={variant === 'elevated' ? 'card' : undefined}
      padding={padding}
      radius={radius}
      {...rest}
    />
  );
}
