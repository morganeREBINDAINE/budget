import { router } from 'expo-router';
import { useState } from 'react';
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
  Stack,
  Switch,
  Text,
  useTheme,
} from '@/design-system';
import { AmountInput } from '@/features/transaction/components/AmountInput';
import { CategoryGrid } from '@/features/transaction/components/CategoryGrid';
import { DateField } from '@/features/transaction/components/DateField';
import { toIsoDate } from '@/lib/format';
import { parseDecimal } from '@/lib/money';
import { fakeRequest } from '@/mocks/account';
import { mockCategories } from '@/mocks/budget';
import type { RecurringFrequency, RecurringPayment } from '@/types/budget';

import { DayOfMonthPicker } from './components/DayOfMonthPicker';
import { MonthPicker } from './components/MonthPicker';
import { FREQUENCY_LABEL } from './recurrence';

type Props = { mode: 'new' } | { mode: 'edit'; payment: RecurringPayment | undefined };

type Errors = Partial<Record<'name' | 'amount' | 'category' | 'day' | 'month' | 'submit', string>>;

export const RECURRING_NAME_MAX_LENGTH = 30;

const FREQUENCIES = (['monthly', 'yearly'] as const).map((value) => ({
  value,
  label: FREQUENCY_LABEL[value],
}));

const goBack = () => router.back();

// Éditeur d'un paiement régulier (création ou modification), écran plein.
export function RecurringEditorScreen(props: Props) {
  const { colors } = useTheme();
  const payment = props.mode === 'edit' ? props.payment : undefined;
  const title = props.mode === 'new' ? 'Nouveau paiement' : 'Modifier le paiement';
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack style={{ paddingHorizontal: screenPadding }}>
        <ScreenHeader title={title} onBack={goBack} />
      </Stack>
      {props.mode === 'edit' && !payment ? (
        <RecurringNotFound />
      ) : (
        <RecurringForm payment={payment} />
      )}
    </SafeAreaView>
  );
}

function dayHint(day: number | null, frequency: RecurringFrequency, month: number | null) {
  if (day === null) return undefined;
  if (frequency === 'yearly' && month === 2 && day === 29)
    return 'Hors année bissextile, l’échéance tombe le 28 février.';
  if (day >= 29) return 'Les mois plus courts, l’échéance tombe le dernier jour du mois.';
  return undefined;
}

function RecurringForm({ payment }: { payment: RecurringPayment | undefined }) {
  const { spacing } = useTheme();
  const now = new Date();
  const [name, setName] = useState(payment?.name ?? '');
  const [amount, setAmount] = useState(payment ? String(payment.amountDa) : '');
  const [categoryId, setCategoryId] = useState<string | null>(payment?.categoryId ?? null);
  const [frequency, setFrequency] = useState<RecurringFrequency>(payment?.frequency ?? 'monthly');
  const [day, setDay] = useState<number | null>(payment?.dayOfMonth ?? now.getDate());
  const [month, setMonth] = useState<number | null>(payment?.month ?? now.getMonth() + 1);
  const [startDate, setStartDate] = useState(payment?.startDate ?? toIsoDate(now));
  const [active, setActive] = useState(payment?.active ?? true);
  const [note, setNote] = useState(payment?.note ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const trimmed = name.trim();
  const amountValue = parseDecimal(amount);

  const clearError = (key: keyof Errors) =>
    setErrors((e) => (e[key] || e.submit ? { ...e, [key]: undefined, submit: undefined } : e));

  const validate = (): Errors => {
    const next: Errors = {};
    if (trimmed === '') next.name = 'Saisis un nom.';
    else if (trimmed.length > RECURRING_NAME_MAX_LENGTH)
      next.name = `${RECURRING_NAME_MAX_LENGTH} caractères maximum.`;
    if (amountValue === null || amountValue <= 0) next.amount = 'Saisis un montant supérieur à 0.';
    else if (!Number.isInteger(amountValue))
      next.amount = 'Le montant en dinars doit être un nombre entier.';
    if (!categoryId) next.category = 'Choisis une catégorie.';
    if (day === null || day < 1 || day > 31) next.day = 'Choisis un jour.';
    if (frequency === 'yearly' && month === null) next.month = 'Choisis un mois.';
    return next;
  };

  // Le bouton bloque déjà les appuis tant que la Promise est en cours.
  // TODO(phase 3) : écriture SQLite (month = null si mensuel) + file de synchro.
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

  // TODO(phase 3) : suppression logique (deleted_at) ; les dépenses déjà créées restent.
  const remove = async () => {
    setDeleteError(null);
    try {
      await fakeRequest(600);
      setConfirmDelete(false);
      goBack();
    } catch {
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
          categories={mockCategories}
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

        <DateField
          label="Date de début"
          value={startDate}
          onChange={(d) => {
            setStartDate(d);
            clearError('submit');
          }}
          hint="Aucune échéance avant cette date."
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
