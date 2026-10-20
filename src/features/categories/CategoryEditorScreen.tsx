import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  FormScrollView,
  Input,
  Row,
  screenPadding,
  ScreenHeader,
  Skeleton,
  Stack,
  Text,
  useTheme,
} from '@/design-system';
import { useDatabase } from '@/db/DatabaseProvider';
import { useUserId } from '@/features/auth/AuthProvider';
import { InitialPullError } from '@/features/sync/components/InitialPullError';
import { LoadingRegion } from '@/features/sync/components/Skeletons';
import { useInitialPull } from '@/features/sync/useInitialPull';
import { CATEGORY_NAME_MAX_LENGTH, validateCategoryName } from '@/lib/categories';
import { updateCategory } from '@/repositories/categories';
import { RowNotFoundError } from '@/repositories/write';
import type { Category } from '@/types/budget';

import { CategoriesReadError } from './components/CategoriesReadError';
import { CategoryIcon } from './components/CategoryIcon';
import { ColorPicker } from './components/ColorPicker';
import { IconPicker } from './components/IconPicker';
import { useCategories, useCategory } from './useCategories';

type Props = { id: string };

type Errors = Partial<Record<'name' | 'submit', string>>;

const goBack = () => router.back();

// Éditeur d'une catégorie : nom, couleur, icône (aperçu en direct).
export function CategoryEditorScreen({ id }: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack style={{ paddingHorizontal: screenPadding }}>
        <ScreenHeader title="Modifier la catégorie" onBack={goBack} />
      </Stack>
      <CategoryEditorContent id={id} />
    </SafeAreaView>
  );
}

function CategoryEditorContent({ id }: Props) {
  const { spacing } = useTheme();
  const { ready, failed } = useInitialPull();
  const category = useCategory(id);
  const categories = useCategories();

  if (failed || category.status === 'error' || categories.status === 'error') {
    return (
      <Stack style={{ paddingHorizontal: screenPadding, paddingTop: spacing.lg }}>
        {failed ? <InitialPullError /> : <CategoriesReadError />}
      </Stack>
    );
  }
  if (!ready || category.status === 'loading' || categories.status === 'loading') {
    return <CategoryEditorSkeleton />;
  }
  if (!category.data) return <CategoryNotFound />;
  // Formulaire initialisé une seule fois : une mise à jour reçue pendant la saisie ne l'écrase pas.
  return <CategoryForm key={category.data.id} category={category.data} others={categories.data} />;
}

function CategoryForm({ category, others }: { category: Category; others: Category[] }) {
  const { spacing } = useTheme();
  const db = useDatabase();
  const userId = useUserId();
  const saving = useRef(false);
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const [icon, setIcon] = useState(category.icon);
  const [errors, setErrors] = useState<Errors>({});

  const trimmed = name.trim();

  // Écriture SQLite synchrone (quasi instantanée) : pas de spinner, garde contre le double appui.
  const save = () => {
    if (saving.current) return;
    const nameError = validateCategoryName(name, category.id, others);
    if (nameError) {
      setErrors({ name: nameError });
      return;
    }
    saving.current = true;
    // Rien de modifié : aucune écriture (pas d'entrée inutile dans la file de synchro).
    if (trimmed === category.name && color === category.color && icon === category.icon) {
      goBack();
      return;
    }
    try {
      updateCategory(db, userId, category.id, { name: trimmed, color, icon });
      goBack();
    } catch (error) {
      saving.current = false;
      console.error('[db] Échec de la modification de la catégorie', error);
      setErrors({
        submit:
          error instanceof RowNotFoundError
            ? "Cette catégorie n'existe plus."
            : "L'enregistrement a échoué. Réessaie.",
      });
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

// Aperçu, champ du nom et nuancier pendant le chargement (quelques millisecondes en général).
function CategoryEditorSkeleton() {
  const { spacing } = useTheme();
  return (
    <LoadingRegion gap="xl" style={{ paddingHorizontal: screenPadding, paddingTop: spacing.lg }}>
      <Card>
        <Row gap="lg">
          <Skeleton width={72} height={72} radius="lg" />
          <Stack flex={1} gap="xxs">
            <Skeleton text="label" width="30%" />
            <Skeleton text="title" width="60%" />
          </Stack>
        </Row>
      </Card>
      <Skeleton height={48} radius="md" />
      <Skeleton height={96} radius="md" />
    </LoadingRegion>
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
