import { Box, type BoxProps } from './Box';

export type RowProps = Omit<BoxProps, 'direction'>;

// Alignement horizontal, centré verticalement par défaut.
export function Row({ align = 'center', ...props }: RowProps) {
  return <Box direction="row" align={align} {...props} />;
}
