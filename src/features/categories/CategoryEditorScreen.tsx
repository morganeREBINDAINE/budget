import { router } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  FormScrollView,
  Input,
  Row,
  screenPadding,
  ScreenHeader,
  Stack,
  Text,
  useTheme,
} from '@/design-system';
import { fakeRequest } from '@/mocks/account';
import type { Category } from '@/types/budget';

import { CategoryIcon } from './components/CategoryIcon';
import { ColorPicker } from './components/ColorPicker';
import { IconPicker } from './components/IconPicker';

type Props = { category: Category | undefined };

type Errors = Partial<Record<'name' | 'submit', string>>;

export const CATEGORY_NAME_MAX_LENGTH = 20;

const goBack = () => router.back();

// Éditeur d'une catégorie : nom, couleur, icône (aperçu en direct).
export function CategoryEditorScreen({ category }: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack style={{ paddingHorizontal: screenPadding }}>
        <ScreenHeader title="Modifier la catégorie" onBack={goBack} />
      </Stack>
      {category ? <CategoryForm category={category} /> : <CategoryNotFound />}
    </SafeAreaView>
  );
}

function CategoryForm({ category }: { category: Category }) {
  const { spacing } = useTheme();
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const [icon, setIcon] = useState(category.icon);
  const [errors, setErrors] = useState<Errors>({});

  const trimmed = name.trim();

  const validate = (): Errors => {
    if (trimmed === '') return { name: 'Saisis un nom.' };
    if (trimmed.length > CATEGORY_NAME_MAX_LENGTH)
      return { name: `${CATEGORY_NAME_MAX_LENGTH} caractères maximum.` };
    return {};
  };

  // Le bouton bloque déjà les appuis tant que la Promise est en cours.
  // TODO(phase 3) : mise à jour SQLite + file de synchro.
  const save = async () => {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    try {
      await fakeRequest(600);
      goBack();
    } catch {
      setErrors({ submit: "L'enregistrement a échoué. Réessaie." });
    }
  };

  return (
    <FormScrollView
      contentContainerStyle={{
        paddingHorizontal: screenPadding,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xxxl,
        gap: spacing.xl,
      }}
    >
      <Card>
        <Row gap="lg">
          <CategoryIcon icon={icon} color={color} size="lg" />
          <Stack flex={1} gap="xxs">
            <Text variant="label" color="textSecondary">
              Aperçu
            </Text>
            <Text variant="title" numberOfLines={1}>
              {trimmed || 'Sans nom'}
            </Text>
          </Stack>
        </Row>
      </Card>

      <Input
        label="Nom"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setErrors({});
        }}
        placeholder="Ex. Courses"
        maxLength={CATEGORY_NAME_MAX_LENGTH + 10}
        hint={`${trimmed.length}/${CATEGORY_NAME_MAX_LENGTH}`}
        autoCapitalize="sentences"
        returnKeyType="done"
        error={errors.name}
      />

      <ColorPicker
        value={color}
        onChange={(c) => {
          setColor(c);
          setErrors((e) => (e.submit ? { ...e, submit: undefined } : e));
        }}
      />

      <IconPicker
        value={icon}
        color={color}
        onChange={(i) => {
          setIcon(i);
          setErrors((e) => (e.submit ? { ...e, submit: undefined } : e));
        }}
      />

      <Stack gap="sm">
        {errors.submit ? (
          <Text variant="bodySmall" color="danger" align="center" accessibilityLiveRegion="polite">
            {errors.submit}
          </Text>
        ) : null}
        <Button label="Enregistrer" variant="secondary" size="lg" fullWidth onPress={save} />
      </Stack>
    </FormScrollView>
  );
}

function CategoryNotFound() {
  return (
    <Stack flex={1} align="center" justify="center" gap="lg" padding="xl">
      <Text variant="title" align="center">
        Catégorie introuvable
      </Text>
      <Text variant="body" color="textSecondary" align="center">
        Elle n&apos;existe plus ou le lien est invalide.
      </Text>
      <Button label="Retour" variant="secondary" onPress={goBack} />
    </Stack>
  );
}
