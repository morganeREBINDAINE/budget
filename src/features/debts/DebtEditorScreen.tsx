import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
  Stack,
  Text,
  useTheme,
} from '@/design-system';
import { AmountInput } from '@/features/transaction/components/AmountInput';
import { DateField } from '@/features/transaction/components/DateField';
import { EurRateField } from '@/features/transaction/components/EurRateField';
import { formatAmount, toIsoDate } from '@/lib/format';
import { amountToInput, eurToDa, parseDecimal, toDecimalInput } from '@/lib/money';
import { fakeRequest } from '@/mocks/account';
import { MOCK_EUR_RATE } from '@/mocks/budget';
import { mockDebtPeople, mockDebtRepayments } from '@/mocks/debts';
import type { Currency, Debt, DebtDirection, DebtRepayment } from '@/types/budget';

import { PersonField } from './components/PersonField';
import { ProgressBar } from './components/ProgressBar';
import { RepaymentRow } from './components/RepaymentRow';

type Props = { mode: 'new'; direction: DebtDirection } | { mode: 'edit'; debt: Debt | undefined };

type Errors = Partial<Record<'person' | 'amount' | 'rate' | 'submit', string>>;

type Section = { key: 'repayments'; data: DebtRepayment[] };

const goBack = () => router.back();

const openRepayment = (id: string) => router.push({ pathname: '/repayment/[id]', params: { id } });

// Éditeur d'une dette (création ou modification) ; en modification, liste des remboursements.
export function DebtEditorScreen(props: Props) {
  const { colors } = useTheme();
  const debt = props.mode === 'edit' ? props.debt : undefined;
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack style={{ paddingHorizontal: screenPadding }}>
        <ScreenHeader
          title={props.mode === 'new' ? 'Nouvelle dette' : 'Modifier la dette'}
          onBack={goBack}
        />
      </Stack>
      {props.mode === 'edit' && !debt ? (
        <DebtNotFound />
      ) : (
        <DebtForm
          debt={debt}
          initialDirection={props.mode === 'new' ? props.direction : (debt?.direction ?? 'i_owe')}
        />
      )}
    </SafeAreaView>
  );
}

type FormProps = { debt: Debt | undefined; initialDirection: DebtDirection };

function DebtForm({ debt, initialDirection }: FormProps) {
  const { spacing } = useTheme();
  const initialPerson = debt
    ? (mockDebtPeople.find((p) => p.id === debt.personId)?.name ?? '')
    : '';

  // Sens fixé par l'onglet d'origine (création) ou par la dette (modification).
  const direction = debt?.direction ?? initialDirection;
  const [person, setPerson] = useState(initialPerson);
  const [amount, setAmount] = useState(debt ? amountToInput(debt) : '');
  const [currency, setCurrency] = useState<Currency>(debt?.currency ?? 'DZD');
  const [rate, setRate] = useState(toDecimalInput(debt?.eurRate ?? MOCK_EUR_RATE));
  const [date, setDate] = useState(debt?.date ?? toIsoDate(new Date()));
  const [note, setNote] = useState(debt?.note ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // TODO(phase 3) : requête SQLite réactive.
  const repayments = useMemo(
    () =>
      debt
        ? mockDebtRepayments
            .filter((r) => r.debtId === debt.id)
            .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        : [],
    [debt],
  );
  const repaid = repayments.reduce((acc, r) => acc + r.amountDa, 0);

  const amountValue = parseDecimal(amount);
  const rateValue = parseDecimal(rate);
  const previewDa =
    currency === 'EUR' && amountValue !== null && rateValue !== null && rateValue > 0
      ? eurToDa(amountValue, rateValue)
      : null;
  const amountDa = currency === 'DZD' ? amountValue : previewDa;

  const clearError = (key: keyof Errors) =>
    setErrors((e) => (e[key] || e.submit ? { ...e, [key]: undefined, submit: undefined } : e));

  const validate = (): Errors => {
    const next: Errors = {};
    if (person.trim() === '') next.person = 'Saisis le nom de la personne.';
    if (amountValue === null || amountValue <= 0) next.amount = 'Saisis un montant supérieur à 0.';
    else if (currency === 'DZD' && !Number.isInteger(amountValue))
      next.amount = 'Le montant en dinars doit être un nombre entier.';
    if (currency === 'EUR' && (rateValue === null || rateValue <= 0))
      next.rate = 'Saisis un taux supérieur à 0.';
    if (!next.amount && !next.rate && amountDa !== null && amountDa < repaid)
      next.amount = `Le montant ne peut pas être inférieur au total déjà remboursé (${formatAmount(repaid)}).`;
    return next;
  };

  // Le bouton bloque déjà les appuis tant que la Promise est en cours.
  // TODO(phase 3) : création de la personne si nouveau nom + écriture SQLite + file de synchro.
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

  // TODO(phase 3) : suppression logique de la dette et de ses remboursements.
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
        people={mockDebtPeople}
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
          <DateField value={date} onChange={setDate} />
        </Stack>
        <Stack flex={1}>
          <Input
            label="Note (optionnel)"
            value={note}
            onChangeText={setNote}
            placeholder="Ex. Avance loyer"
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
          settled={debt.amountDa - repaid <= 0}
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
  const remaining = Math.max(0, amountDa - repaidDa);
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
