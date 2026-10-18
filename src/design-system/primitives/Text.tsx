import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import type { ThemeColor } from '../theme/light';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, type FontWeightToken, type TypographyVariant } from '../tokens/typography';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: ThemeColor;
  weight?: FontWeightToken;
  align?: TextStyle['textAlign'];
  // Chiffres à chasse fixe pour aligner les montants.
  tabular?: boolean;
};

export function Text({
  variant = 'body',
  color = 'text',
  weight,
  align,
  tabular,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const textStyle: TextStyle = {
    ...theme.typography[variant],
    color: theme.colors[color],
    fontFamily: weight ? fontFamily[weight] : theme.typography[variant].fontFamily,
    textAlign: align,
    fontVariant: tabular ? ['tabular-nums'] : undefined,
  };
  return <RNText style={[textStyle, style]} {...rest} />;
}
