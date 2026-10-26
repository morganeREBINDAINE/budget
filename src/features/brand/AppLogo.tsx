import { Image } from 'expo-image';

type Props = { size?: number };

const logo = require('../../../assets/images/logo.png');

// Logo de l'app : portefeuille 3D indigo, fond transparent.
export function AppLogo({ size = 36 }: Props) {
  return (
    <Image
      source={logo}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
