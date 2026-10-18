import { View, type ViewProps, type ViewStyle } from 'react-native';

import type { ThemeColor } from '../theme/light';
import { useTheme } from '../theme/ThemeProvider';
import type { RadiusToken } from '../tokens/radius';
import type { ShadowToken } from '../tokens/shadows';
import type { SpacingToken } from '../tokens/spacing';

export type BoxProps = ViewProps & {
  padding?: SpacingToken;
  paddingX?: SpacingToken;
  paddingY?: SpacingToken;
  margin?: SpacingToken;
  marginX?: SpacingToken;
  marginY?: SpacingToken;
  gap?: SpacingToken;
  bg?: ThemeColor;
  radius?: RadiusToken;
  shadow?: ShadowToken;
  borderColor?: ThemeColor;
  flex?: number;
  direction?: ViewStyle['flexDirection'];
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
};

// Conteneur de base : toutes les valeurs passent par les tokens du thème.
export function Box({
  padding,
  paddingX,
  paddingY,
  margin,
  marginX,
  marginY,
  gap,
  bg,
  radius,
  shadow,
  borderColor,
  flex,
  direction,
  align,
  justify,
  wrap,
  style,
  ...rest
}: BoxProps) {
  const theme = useTheme();
  const s = (token?: SpacingToken) => (token === undefined ? undefined : theme.spacing[token]);

  const boxStyle: ViewStyle = {
    padding: s(padding),
    paddingHorizontal: s(paddingX),
    paddingVertical: s(paddingY),
    margin: s(margin),
    marginHorizontal: s(marginX),
    marginVertical: s(marginY),
    gap: s(gap),
    backgroundColor: bg ? theme.colors[bg] : undefined,
    borderRadius: radius ? theme.radius[radius] : undefined,
    borderColor: borderColor ? theme.colors[borderColor] : undefined,
    borderWidth: borderColor ? 1 : undefined,
    flex,
    flexDirection: direction,
    alignItems: align,
    justifyContent: justify,
    flexWrap: wrap ? 'wrap' : undefined,
    ...(shadow ? theme.shadows[shadow] : undefined),
  };

  return <View style={[boxStyle, style]} {...rest} />;
}
