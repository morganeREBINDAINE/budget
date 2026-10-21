import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ReactNode, useCallback, useRef, useState } from 'react';
import type { SectionListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  FormSectionList,
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
import { ReadErrorCard } from '@/features/db/ReadErrorCard';
import { InitialPullError } from '@/features/sync/components/InitialPullError';
import { LoadingRegion } from '@/features/sync/components/Skeletons';
import { useInitialPull } from '@/features/sync/useInitialPull';
import { AmountInput } from '@/features/transaction/components/AmountInput';
import { DateField } from '@/features/transaction/components/DateField';
import { EurRateField } from '@/features/transaction/components/EurRateField';
import { readLastEurRate, rememberEurRate } from '@/features/transaction/lastEurRate';
import {
  DEBT_NOTE_MAX_LENGTH,
  type DebtErrors,
  isDebtUnchanged,
  remainingOf,
  validateDebt,
} from '@/lib/debts';
import { formatAmount, toIsoDate } from '@/lib/format';
import {
  amountToInput,
  eurCentsToDa,
  parseDecimal,
  parseEurCents,
  toDecimalInput,
} from '@/lib/money';
import { createDebt, deleteDebt, updateDebt } from '@/repositories/debts';
import { RowNotFoundError } from '@/repositories/write';
import type { Currency, Debt, DebtDirection, DebtPerson, DebtRepayment } from '@/types/budget';

import { PersonField } from './components/PersonField';
import { ProgressBar } from './components/ProgressBar';
import { RepaymentRow } from './components/RepaymentRow';
import { useDebt, useDebtPeople, useDebtRepayments } from './useDebts';

type Props = { mode: 'new'; direction: DebtDirection } | { mode: 'edit'; id: string };

type Errors = DebtErrors & { submit?: string };

type Section = { key: 'repayments'; data: DebtRepayment[] };

const NO_REPAYMENTS: DebtRepayment[] = [];

const goBack = () => router.back();

const openRepayment = (id: string) => router.push({ pathname: '/repayment/[id]', params: { id } });

// Éditeur d'une dette (création ou modification) ; en modification, liste des remboursements.
export function DebtEditorScreen(props: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack style={{ paddingHorizontal: screenPadding }}>
        <ScreenHeader
          title={props.mode === 'new' ? 'Nouvelle dette' : 'Modifier la dette'}
          onBack={goBack}
        />
      </Stack>
      {props.mode === 'edit' ? (
        <EditContent id={props.id} />
      ) : (
        <NewContent direction={props.direction} />
      )}
    </SafeAreaView>
  );
}

function DebtsReadError() {
  return (
    <ReadErrorCard
      title="Dettes indisponibles"
      message="Impossible de lire les dettes enregistrées sur le téléphone. Ferme puis rouvre l'application."
    />
  );
}

function ErrorContainer({ children }: { children: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <Stack style={{ paddingHorizontal: screenPadding, paddingTop: spacing.lg }}>{children}</Stack>
  );
}

// Pendant le pull initial ou la lecture : skeletons ; échec : bloc d'erreur (toast déjà affiché).
function NewContent({ direction }: { direction: DebtDirection }) {
  const { ready, failed } = useInitialPull();
  const people = useDebtPeople();
  if (failed) {
    return (
      <ErrorContainer>
        <InitialPullError />
      </ErrorContainer>
    );
  }
  if (people.status === 'error') {
    return (
      <ErrorContainer>
        <DebtsReadError />
      </ErrorContainer>
    );
  }
  if (!ready || people.status === 'loading') return <DebtFormSkeleton />;
  return (
    <DebtForm
      debt={undefined}
      direction={direction}
      people={people.data}
      repayments={NO_REPAYMENTS}
    />
  );
}

function EditContent({ id }: { id: string }) {
  const { ready, failed } = useInitialPull();
  const debt = useDebt(id);
  const repayments = useDebtRepayments(id);
  const people = useDebtPeople();
  // Dernière version lue : après une suppression, le formulaire reste affiché pendant le retour
  // au lieu de basculer sur « introuvable ».
  const [lastRead, setLastRead] = useState<Debt | undefined>(undefined);
  const current = debt.status === 'ready' ? debt.data : undefined;
  if (current && current !== lastRead) setLastRead(current);
  const shown = current ?? lastRead;

  if (failed) {
    return (
      <ErrorContainer>
        <InitialPullError />
      </ErrorContainer>
    );
  }
  if (debt.status === 'error' || repayments.status === 'error' || people.status === 'error') {
    return (
      <ErrorContainer>
        <DebtsReadError />
      </ErrorContainer>
    );
  }
  if (
    !ready ||
    repayments.status === 'loading' ||
    people.status === 'loading' ||
    (!shown && debt.status === 'loading')
  ) {
    return <DebtFormSkeleton />;
  }
  if (!shown) return <DebtNotFound />;
  // Champs initialisés une seule fois (clé stable) : une synchro pendant la saisie ne les écrase
  // pas ; les remboursements, eux, restent à jour.
  return (
    <DebtForm
      key={shown.id}
      debt={shown}
      direction={shown.direction}
      people={people.data}
      repayments={repayments.data}
    />
  );
}

type FormProps = {
  debt: Debt | undefined;
  // Sens fixé par l'onglet d'origine (création) ou par la dette (modification).
  direction: DebtDirection;
  people: DebtPerson[];
  repayments: DebtRepayment[];
};

function DebtForm({ debt, direction, people, repayments }: FormProps) {
  const { spacing } = useTheme();
  const db = useDatabase();
  const userId = useUserId();
  const writing = useRef(false);
  const today = toIsoDate(new Date());
  const [initialPerson] = useState(() =>
    debt ? (people.find((p) => p.id === debt.personId)?.name ?? '') : '',
  );

  const [person, setPerson] = useState(initialPerson);
  const [amount, setAmount] = useState(debt ? amountToInput(debt) : '');
  const [currency, setCurrency] = useState<Currency>(debt?.currency ?? 'DZD');
  // Taux de la dette, sinon dernier taux saisi ; jamais de valeur par défaut.
  const [rate, setRate] = useState(() => {
    const initial = debt?.eurRate ?? readLastEurRate(db, userId);
    return initial !== null ? toDecimalInput(initial) : '';
  });
  const [date, setDate] = useState(debt?.date ?? today);
  const [note, setNote] = useState(debt?.note ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const repaid = repayments.reduce((acc, r) => acc + r.amountDa, 0);

  const cents = parseEurCents(amount);
  const rateValue = parseDecimal(rate);
  const previewDa =
    currency === 'EUR' && cents !== null && rateValue !== null && rateValue > 0
      ? eurCentsToDa(cents, rateValue)
      : null;

  const clearError = (key: keyof Errors) =>
    setErrors((e) => (e[key] || e.submit ? { ...e, [key]: undefined, submit: undefined } : e));

  // Écriture SQLite synchrone (quasi instantanée) : pas de spinner, garde contre le double appui.
  const save = () => {
    if (writing.current) return;
    const result = validateDebt(
      { person, amount, currency, rate, date, note },
      { today: toIsoDate(new Date()), repaidDa: repaid },
    );
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    writing.current = true;
    // Rien de modifié : aucune écriture (pas d'entrée inutile dans la file de synchro).
    if (debt && isDebtUnchanged(debt, initialPerson.trim(), result.values)) {
      goBack();
      return;
    }
    try {
      if (debt) updateDebt(db, userId, debt.id, result.values);
      else createDebt(db, userId, direction, result.values);
    } catch (error) {
      writing.current = false;
      console.error("[db] Échec de l'enregistrement de la dette", error);
      setErrors({
        submit:
          error instanceof RowNotFoundError
            ? "Cette dette n'existe plus."
            : "L'enregistrement a échoué. Réessaie.",
      });
      return;
    }
    // Dette déjà enregistrée : un échec ici ne fait que perdre le préremplissage.
    rememberEurRate(db, userId, result.values.eurRate);
    goBack();
  };

  // Suppression logique de la dette, de ses remboursements et de la personne sans autre dette.
  const remove = () => {
    if (!debt || writing.current) return;
    writing.current = true;
    setDeleteError(null);
    try {
      deleteDebt(db, userId, debt.id);
    } catch (error) {
      // Déjà supprimée (ex. par une synchro) : le résultat attendu est atteint.
      if (!(error instanceof RowNotFoundError)) {
        writing.current = false;
        console.error('[db] Échec de la suppression de la dette', error);
        setDeleteError('La suppression a échoué. Réessaie.');
        return;
      }
    }
    setConfirmDelete(false);
    goBack();
  };

  const renderItem: SectionListRenderItem<DebtRepayment, Section> = useCallback(
    ({ item }) => <RepaymentRow repayment={item} onPress={openRepayment} />,
    [],
  );

  const sections: Section[] = debt ? [{ key: 'repayments', data: repayments }] : [];

  const header = (
    <Stack gap="xl" style={{ marginBottom: debt ? spacing.lg : 0 }}>
      {debt && <DebtSummary amountDa={debt.amountDa} repaidDa={repaid} />}

      <PersonField
        label={direction === 'i_owe' ? 'À qui je dois ?' : 'Qui me doit ?'}
        value={person}
        onChange={(v) => {
          setPerson(v);
          clearError('person');
        }}
        people={people}
        error={errors.person}
      />

      <AmountInput
        value={amount}
        onChangeText={(v) => {
          setAmount(v);
          clearError('amount');
        }}
        currency={currency}
        onToggleCurrency={() => {
          setCurrency((c) => (c === 'DZD' ? 'EUR' : 'DZD'));
          clearError('amount');
        }}
        error={errors.amount}
      />

      {currency === 'EUR' && amount.trim() !== '' && (
        <EurRateField
          rate={rate}
          onChangeRate={(v) => {
            setRate(v);
            clearError('rate');
          }}
          previewDa={previewDa}
          error={errors.rate}
        />
      )}

      <Row gap="md" align="flex-start">
        <Stack flex={1}>
          <DateField
            value={date}
            onChange={(d) => {
              setDate(d);
              clearError('date');
            }}
            maximumDate={today}
            error={errors.date}
          />
        </Stack>
        <Stack flex={1}>
          <Input
            label="Note (optionnel)"
            value={note}
            onChangeText={setNote}
            placeholder="Ex. Avance loyer"
            maxLength={DEBT_NOTE_MAX_LENGTH}
            returnKeyType="done"
          />
        </Stack>
      </Row>

      <Stack gap="sm">
        {errors.submit ? (
          <Text variant="bodySmall" color="danger" align="center" accessibilityLiveRegion="polite">
            {errors.submit}
          </Text>
        ) : null}
        <Button
          label={debt ? 'Enregistrer' : 'Ajouter la dette'}
          variant="secondary"
          size="lg"
          fullWidth
          onPress={save}
        />
      </Stack>

      {debt && (
        <RepaymentsHeader
          count={repayments.length}
          settled={remainingOf(debt.amountDa, repaid) === 0}
          onAdd={() => router.push({ pathname: '/repayment/new', params: { debtId: debt.id } })}
        />
      )}
    </Stack>
  );

  return (
    <>
      <FormSectionList
        sections={sections}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? (
            <Text variant="bodySmall" color="textSecondary" align="center">
              Aucun remboursement pour l&apos;instant.
            </Text>
          ) : null
        }
        ItemSeparatorComponent={Separator}
        ListFooterComponent={
          debt ? (
            <Stack style={{ marginTop: spacing.xxl }}>
              <Button
                label="Supprimer la dette"
                variant="danger"
                size="lg"
                fullWidth
                onPress={() => {
                  setDeleteError(null);
                  setConfirmDelete(true);
                }}
              />
            </Stack>
          ) : null
        }
        contentContainerStyle={{
          paddingHorizontal: screenPadding,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxxl,
        }}
      />

      {debt && (
        <ConfirmDialog
          visible={confirmDelete}
          variant="danger"
          title="Supprimer cette dette ?"
          message={
            repayments.length > 0
              ? `La dette et ses ${repayments.length} remboursement${repayments.length > 1 ? 's' : ''} seront supprimés.`
              : 'Cette action est définitive.'
          }
          confirmLabel="Supprimer"
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
          error={deleteError}
        />
      )}
    </>
  );
}

type SummaryProps = { amountDa: number; repaidDa: number };

// Synthèse : reste dû, progression, déjà remboursé.
function DebtSummary({ amountDa, repaidDa }: SummaryProps) {
  const remaining = remainingOf(amountDa, repaidDa);
  return (
    <Card radius="xl" gap="sm">
      <Row justify="space-between">
        <Text variant="label" color="textSecondary">
          Reste dû
        </Text>
        {remaining === 0 && <Badge label="Soldée" variant="success" />}
      </Row>
      <Text variant="display" tabular>
        {formatAmount(remaining)}
      </Text>
      <ProgressBar progress={repaidDa / amountDa} />
      <Text variant="bodySmall" color="textSecondary" tabular>
        Remboursé {formatAmount(repaidDa)} sur {formatAmount(amountDa)}
      </Text>
    </Card>
  );
}

type RepaymentsHeaderProps = { count: number; settled: boolean; onAdd: () => void };

function RepaymentsHeader({ count, settled, onAdd }: RepaymentsHeaderProps) {
  const { colors, spacing } = useTheme();
  return (
    <Stack gap="md" style={{ marginTop: spacing.sm }}>
      <Row gap="sm" align="baseline">
        <Text variant="title">Remboursements</Text>
        <Text variant="body" color="textMuted">
          {count}
        </Text>
      </Row>
      {settled ? (
        <Text variant="bodySmall" color="textSecondary">
          Dette soldée : touche un remboursement pour le corriger.
        </Text>
      ) : (
        <Button
          label="Ajouter un remboursement"
          variant="outline"
          fullWidth
          leftIcon={<MaterialCommunityIcons name="plus" size={20} color={colors.textStrong} />}
          onPress={onAdd}
        />
      )}
    </Stack>
  );
}

// Formulaire pendant la lecture : libellés fixes, champs remplacés.
function DebtFormSkeleton() {
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
        {field('Personne', 48)}
        {field('Montant', 64)}
        {field('Date', 48)}
      </LoadingRegion>
    </Stack>
  );
}

function DebtNotFound() {
  return (
    <Stack flex={1} align="center" justify="center" gap="lg" padding="xl">
      <Text variant="title" align="center">
        Dette introuvable
      </Text>
      <Text variant="body" color="textSecondary" align="center">
        Elle n&apos;existe plus ou le lien est invalide.
      </Text>
      <Button label="Retour" variant="secondary" onPress={goBack} />
    </Stack>
  );
}

function Separator() {
  const { spacing } = useTheme();
  return <Stack style={{ height: spacing.sm }} />;
}
