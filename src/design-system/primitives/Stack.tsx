import { Box, type BoxProps } from './Box';

export type StackProps = Omit<BoxProps, 'direction'>;

// Empilement vertical avec espacement par token.
export function Stack(props: StackProps) {
  return <Box direction="column" {...props} />;
}
