import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { Input, useTheme } from '@/design-system';

type Props = {
  value: string;
  onChange: (value: string) => void;
  // Champ quitté : l'accueil ferme la barre si elle est vide.
  onBlur: () => void;
  // Croix : vide le champ et ferme la barre.
  onClear: () => void;
};

// Barre de recherche de l'accueil, ouverte par la loupe de la barre haute (focus à l'ouverture).
export function HomeSearchBar({ value, onChange, onBlur, onClear }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <Input
      value={value}
      onChangeText={onChange}
      onBlur={onBlur}
      autoFocus
      placeholder="Note, catégorie, montant…"
      accessibilityLabel="Rechercher dans le détail"
      returnKeyType="search"
      autoCorrect={false}
      leftIcon={<MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />}
      rightIcon={
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Effacer la recherche"
          hitSlop={spacing.md}
        >
          <MaterialCommunityIcons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      }
    />
  );
}
