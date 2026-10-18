import { useCallback } from 'react';
import { SectionList, type ScrollViewProps, type SectionListProps } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { useTheme } from '../theme/ThemeProvider';

export type FormSectionListProps<ItemT, SectionT> = SectionListProps<ItemT, SectionT> & {
  // Espace gardé entre le champ actif et le clavier (défaut spacing.xxl).
  bottomOffset?: number;
};

/**
 * SectionList virtualisée pour un écran qui contient aussi des champs de saisie
 * (ex. formulaire en en-tête + liste longue) : le champ actif reste visible au-dessus du clavier.
 */
export function FormSectionList<ItemT, SectionT>({
  bottomOffset,
  ...rest
}: FormSectionListProps<ItemT, SectionT>) {
  const { spacing } = useTheme();
  const offset = bottomOffset ?? spacing.xxl;
  const renderScrollComponent = useCallback(
    (props: ScrollViewProps) => <KeyboardAwareScrollView {...props} bottomOffset={offset} />,
    [offset],
  );
  return (
    <SectionList
      renderScrollComponent={renderScrollComponent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      {...rest}
    />
  );
}
