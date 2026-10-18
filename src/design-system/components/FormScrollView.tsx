import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import type { ComponentProps } from 'react';

import { useTheme } from '../theme/ThemeProvider';

export type FormScrollViewProps = ComponentProps<typeof KeyboardAwareScrollView>;

// ScrollView de formulaire : garde le champ en cours de saisie visible au-dessus du clavier.
export function FormScrollView({ bottomOffset, ...rest }: FormScrollViewProps) {
  const { spacing } = useTheme();
  return (
    <KeyboardAwareScrollView
      bottomOffset={bottomOffset ?? spacing.xxl}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...rest}
    />
  );
}
