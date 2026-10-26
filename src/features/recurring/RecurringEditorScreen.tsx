import { router } from 'expo-router';
import { type ReactNode, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  ConfirmDialog,
  FormScrollView,
  Input,
  screenPadding,
  ScreenHeader,
  SegmentedControl,
  Skeleton,
  Stack,
  Switch,
  Text,
  useTheme,
} from '@/design-system';
import { useDatabase } from '@/db/DatabaseProvider';
import { useUserId } from '@/features/auth/AuthProvider';
import { CategoriesReadError } from '@/features/categories/components/CategoriesReadError';
import { useCategories } from '@/features/categories/useCategories';
import { ReadErrorCard } from '@/features/db/ReadErrorCard';
import { InitialPullError } from '@/features/sync/components/InitialPullError';
import { LoadingRegion } from '@/features/sync/components/Skeletons';
import { useInitialPull } from '@/features/sync/useInitialPull';
import { AmountInput } from '@/features/transaction/components/AmountInput';
import { CategoryGrid } from '@/features/transaction/components/CategoryGrid';
import { toIsoDate } from '@/lib/format';
import { formatAmountInput } from '@/lib/money';
import {
  isRecurringUnchanged,
  RECURRING_NAME_MAX_LENGTH,
  RECURRING_NOTE_MAX_LENGTH,
  type RecurringErrors,
  validateRecurring,
} from '@/lib/recurring';
import {
  createRecurringPayment,
  deleteRecurringPayment,
  updateRecurringPayment,
} from '@/repositories/recurring';
import { RowNotFoundError } from '@/repositories/write';
import type { Category, RecurringFrequency, RecurringPayment } from '@/types/budget';

import { DayOfMonthPicker } from './components/DayOfMonthPicker';
import { MonthPicker } from './components/MonthPicker';
import { FREQUENCY_LABEL } from './recurrence';
import { useRecurringPayment } from './useRecurring';

type Props = { mode: 'new' } | { mode: 'edit'; id: string };

type Errors = RecurringErrors & { submit?: string };

const FREQUENCIES = (['monthly', 'yearly'] as const).map((value) => ({
  value,
  label: FREQUENCY_LABEL[value],
}));

const goBack = () => router.back();

// Éditeur d'un paiement régulier (création ou modification), écran plein.
export function RecurringEditorScreen(props: Props) {
  const { colors } = useTheme();
  const title = props.mode === 'new' ? 'Nouveau paiement' : 'Modifier le paiement';
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack style={{ paddingHorizontal: screenPadding }}>
        <ScreenHeader title={title} onBack={goBack} />
      </Stack>
      {props.mode === 'edit' ? <EditContent id={props.id} /> : <NewContent />}
    </SafeAreaView>
  );
}

// Pendant le pull initial ou la lecture : skeletons ; échec : bloc d'erreur (toast déjà affiché).
function NewContent() {
  const { ready, failed } = useInitialPull();
  const categories = useCategories();
  if (failed)
    return (
      <ErrorContainer>
        <InitialPullError />
      </ErrorContainer>
    );
  if (categories.status === 'error') {
    return (
      <ErrorContainer>
        <CategoriesReadError />
      </ErrorContainer>
    );
  }
  if (!ready || categories.status === 'loading') return <RecurringFormSkeleton />;
  return <RecurringForm payment={undefined} categories={categories.data} />;
}

function EditContent({ id }: { id: string }) {
  const { ready, failed } = useInitialPull();
  const categories = useCategories();
  const payment = useRecurringPayment(id);
  // Dernière version lue : après une suppression, le formulaire reste affiché pendant le retour
  // au lieu de basculer sur « introuvable ».
  const [lastRead, setLastRead] = useState<RecurringPayment | undefined>(undefined);
  const current = payment.status === 'ready' ? payment.data : undefined;
  if (current && current !== lastRead) setLastRead(current);
  const shown = current ?? lastRead;

  if (failed)
    return (
      <ErrorContainer>
        <InitialPullError />
      </ErrorContainer>
    );
  if (categories.status === 'error') {
    return (
      <ErrorContainer>
        <CategoriesReadError />
      </ErrorContainer>
    );
  }
  if (payment.status === 'error') {
    return (
      <ErrorContainer>
        <ReadErrorCard
          title="Paiement indisponible"
          message="Impossible de le lire sur le téléphone. Ferme puis rouvre l'application."
        />
      </ErrorContainer>
    );
  }
  if (!ready || categories.status === 'loading' || (!shown && payment.status === 'loading')) {
    return <RecurringFormSkeleton />;
  }
  if (!shown) return <RecurringNotFound />;
  // Initialisé une seule fois (clé stable) : une synchro pendant la saisie ne l'écrase pas.
  return <RecurringForm key={shown.id} payment={shown} categories={categories.data} />;
}

function ErrorContainer({ children }: { children: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <Stack style={{ paddingHorizontal: screenPadding, paddingTop: spacing.lg }}>{children}</Stack>
  );
}

function dayHint(day: number | null, frequency: RecurringFrequency, month: number | null) {
  if (day === null) return undefined;
  if (frequency === 'yearly' && month === 2 && day === 29)
    return 'Hors année bissextile, l’échéance tombe le 28 février.';
  if (day >= 29) return 'Les mois plus courts, l’échéance tombe le dernier jour du mois.';
  return undefined;
}

function RecurringForm({
  payment,
  categories,
}: {
  payment: RecurringPayment | undefined;
  categories: Category[];
}) {
  const { spacing } = useTheme();
  const db = useDatabase();
  const userId = useUserId();
  const writing = useRef(false);
  const now = new Date();
  const today = toIsoDate(now);
  const [name, setName] = useState(payment?.name ?? '');
  const [amount, setAmount] = useState(payment ? formatAmountInput(String(payment.amountDa)) : '');
  const [categoryId, setCategoryId] = useState<string | null>(payment?.categoryId ?? null);
  const [frequency, setFrequency] = useState<RecurringFrequency>(payment?.frequency ?? 'monthly');
  const [day, setDay] = useState<number | null>(payment?.dayOfMonth ?? now.getDate());
  const [month, setMonth] = useState<number | null>(payment?.month ?? now.getMonth() + 1);
  const [active, setActive] = useState(payment?.active ?? true);
  const [note, setNote] = useState(payment?.note ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const trimmed = name.trim();

  const clearError = (key: keyof Errors) =>
    setErrors((e) => (e[key] || e.submit ? { ...e, [key]: undefined, submit: undefined } : e));

  // Écriture SQLite synchrone (quasi instantanée) : pas de spinner, garde contre le double appui.
  const save = () => {
    if (writing.current) return;
    // Date de début interne (pas de champ) : aujourd'hui à la création et à la réactivation
    // d'un paiement inactif (pas d'arriéré pour la période d'inactivité), inchangée sinon.
    const reactivated = payment !== undefined && !payment.active && active;
    const startDate = !payment || reactivated ? today : payment.startDate;
    const result = validateRecurring(
      { name, amount, categoryId, frequency, dayOfMonth: day, month, startDate, active, note },
      new Set(categories.map((c) => c.id)),
    );
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    writing.current = true;
    try {
      if (!payment) createRecurringPayment(db, userId, result.values);
      // Rien de modifié : aucune écriture (pas d'entrée inutile dans la file de synchro).
      else if (!isRecurringUnchanged(payment, result.values)) {
        updateRecurringPayment(db, userId, payment.id, result.values);
      }
      goBack();
    } catch (error) {
      writing.current = false;
      console.error("[db] Échec de l'enregistrement du paiement régulier", error);
      setErrors({
        submit:
          error instanceof RowNotFoundError
            ? "Ce paiement n'existe plus."
            : "L'enregistrement a échoué. Réessaie.",
      });
    }
  };

  // Suppression logique : les dépenses et occurrences déjà enregistrées restent.
  const remove = () => {
    if (!payment || writing.current) return;
    writing.current = true;
    setDeleteError(null);
    try {
      deleteRecurringPayment(db, userId, payment.id);
      setConfirmDelete(false);
      goBack();
    } catch (error) {
      // Déjà supprimé (ex. par une synchro) : le résultat attendu est atteint.
      if (error instanceof RowNotFoundError) {
        setConfirmDelete(false);
        goBack();
        return;
      }
      writing.current = false;
      console.error('[db] Échec de la suppression du paiement régulier', error);
      setDeleteError('La suppression a échoué. Réessaie.');
    }
  };

  return (
    <>
      <FormScrollView
        contentContainerStyle={{
          paddingHorizontal: screenPadding,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.xl,
        }}
      >
        <Input
          label="Nom"
          value={name}
          onChangeText={(v) => {
            setName(v);
            clearError('name');
          }}
          placeholder="Ex. Loyer"
          maxLength={RECURRING_NAME_MAX_LENGTH + 10}
          hint={`${trimmed.length}/${RECURRING_NAME_MAX_LENGTH}`}
          autoCapitalize="sentences"
          returnKeyType="done"
          error={errors.name}
        />

        <AmountInput
          value={amount}
          onChangeText={(v) => {
            setAmount(v);
            clearError('amount');
          }}
          currency="DZD"
          error={errors.amount}
        />

        <CategoryGrid
          categories={categories}
          value={categoryId}
          onChange={(id) => {
            setCategoryId(id);
            clearError('category');
          }}
          error={errors.category}
        />

        <SegmentedControl
          label="Fréquence"
          options={FREQUENCIES}
          value={frequency}
          onChange={(f) => {
            setFrequency(f);
            clearError('month');
          }}
        />

        {frequency === 'yearly' && (
          <MonthPicker
            value={month}
            onChange={(m) => {
              setMonth(m);
              clearError('month');
            }}
            error={errors.month}
          />
        )}

        <DayOfMonthPicker
          value={day}
          onChange={(d) => {
            setDay(d);
            clearError('day');
          }}
          hint={dayHint(day, frequency, month)}
          error={errors.day}
        />

        <Card>
          <Switch
            label="Actif"
            description={
              active
                ? "Un encart s'affiche sur l'accueil à chaque échéance."
                : "Plus aucun encart sur l'accueil."
            }
            value={active}
            onValueChange={(v) => {
              setActive(v);
              clearError('submit');
            }}
          />
        </Card>

        <Input
          label="Note (optionnel)"
          value={note}
          onChangeText={setNote}
          placeholder="Ex. Virement au propriétaire"
          maxLength={RECURRING_NOTE_MAX_LENGTH}
          returnKeyType="done"
        />

        <Stack gap="sm">
          {errors.submit ? (
            <Text
              variant="bodySmall"
              color="danger"
              align="center"
              accessibilityLiveRegion="polite"
            >
              {errors.submit}
            </Text>
          ) : null}
          <Button
            label={payment ? 'Enregistrer' : 'Ajouter le paiement'}
            variant="secondary"
            size="lg"
            fullWidth
            onPress={save}
          />
          {payment && (
            <Button
              label="Supprimer"
              variant="danger"
              size="lg"
              fullWidth
              onPress={() => {
                setDeleteError(null);
                setConfirmDelete(true);
              }}
            />
          )}
        </Stack>
      </FormScrollView>

      {payment && (
        <ConfirmDialog
          visible={confirmDelete}
          variant="danger"
          title="Supprimer ce paiement ?"
          message={`« ${payment.name} » n'affichera plus d'encart. Les dépenses déjà enregistrées sont conservées.`}
          confirmLabel="Supprimer"
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
          error={deleteError}
        />
      )}
    </>
  );
}

// Formulaire pendant la lecture : libellés fixes, champs remplacés.
function RecurringFormSkeleton() {
  const { spacing } = useTheme();
  const field = (label: string, height: number) => (
    <Stack gap="xs">
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <Skeleton height={height} radius="md" />
    </Stack>
  );
  return (
    <Stack style={{ paddingHorizontal: screenPadding, paddingTop: spacing.lg }}>
      <LoadingRegion gap="xl">
        {field('Nom', 48)}
        {field('Montant', 64)}
        {field('Sélectionner une catégorie', 200)}
        {field('Fréquence', 48)}
      </LoadingRegion>
    </Stack>
  );
}

function RecurringNotFound() {
  return (
    <Stack flex={1} align="center" justify="center" gap="lg" padding="xl">
      <Text variant="title" align="center">
        Paiement introuvable
      </Text>
      <Text variant="body" color="textSecondary" align="center">
        Il n&apos;existe plus ou le lien est invalide.
      </Text>
      <Button label="Retour" variant="secondary" onPress={goBack} />
    </Stack>
  );
}
