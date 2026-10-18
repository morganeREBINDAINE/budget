import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable } from 'react-native';

import {
  Button,
  Card,
  ConfirmDialog,
  FormScrollView,
  Input,
  Row,
  Stack,
  Text,
  useSheet,
  useTheme,
} from '@/design-system';
import { AmountInput } from '@/features/transaction/components/AmountInput';
import { DateField } from '@/features/transaction/components/DateField';
import { EurRateField } from '@/features/transaction/components/EurRateField';
import { remainingDa } from '@/lib/debts';
import { formatAmount, toIsoDate } from '@/lib/format';
import { amountToInput, eurToDa, parseDecimal, toDecimalInput } from '@/lib/money';
import { fakeRequest } from '@/mocks/account';
import { MOCK_EUR_RATE } from '@/mocks/budget';
import { mockDebtPeople, mockDebtRepayments } from '@/mocks/debts';
import type { Currency, Debt, DebtRepayment } from '@/types/budget';

type Props = { debt: Debt; repayment?: DebtRepayment };

type Errors = Partial<Record<'amount' | 'rate' | 'submit', string>>;

// Feuille d'ajout / modification d'un remboursement partiel (aucun lien avec le budget).
export function RepaymentForm({ debt, repayment }: Props) {
  const { colors, spacing, radius } = useTheme();
  const { close } = useSheet();
  const personName = mockDebtPeople.find((p) => p.id === debt.personId)?.name ?? 'cette personne';
  // En modification, le remboursement en cours ne compte pas dans le reste dû autorisé.
  const maxDa = remainingDa(debt, mockDebtRepayments) + (repayment?.amountDa ?? 0);

  const [amount, setAmount] = useState(repayment ? amountToInput(repayment) : '');
  const [currency, setCurrency] = useState<Currency>(repayment?.currency ?? 'DZD');
  const [rate, setRate] = useState(toDecimalInput(repayment?.eurRate ?? MOCK_EUR_RATE));
  const [date, setDate] = useState(repayment?.date ?? toIsoDate(new Date()));
  const [note, setNote] = useState(repayment?.note ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    if (amountValue === null || amountValue <= 0) next.amount = 'Saisis un montant supérieur à 0.';
    else if (currency === 'DZD' && !Number.isInteger(amountValue))
      next.amount = 'Le montant en dinars doit être un nombre entier.';
    if (currency === 'EUR' && (rateValue === null || rateValue <= 0))
      next.rate = 'Saisis un taux supérieur à 0.';
    if (!next.amount && !next.rate && amountDa !== null && amountDa > maxDa)
      next.amount = `Le remboursement dépasse le reste dû (${formatAmount(maxDa)}).`;
    return next;
  };

  // TODO(phase 3) : écriture SQLite + file de synchro.
  const save = async () => {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    try {
      await fakeRequest(600);
      close();
    } catch {
      setErrors({ submit: "L'enregistrement a échoué. Réessaie." });
    }
  };

  // TODO(phase 3) : suppression logique (deleted_at).
  const remove = async () => {
    setDeleteError(null);
    try {
      await fakeRequest(600);
      setConfirmDelete(false);
      close();
    } catch {
      setDeleteError('La suppression a échoué. Réessaie.');
    }
  };

  const fillRemaining = () => {
    setCurrency('DZD');
    setAmount(String(maxDa));
    clearError('amount');
  };

  return (
    <>
      <FormScrollView
        style={{ flex: 1, backgroundColor: colors.surface }}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.xxl,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
      >
        <Row justify="space-between">
          <Text variant="title">
            {repayment ? 'Modifier le remboursement' : 'Nouveau remboursement'}
          </Text>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={spacing.sm}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.border : colors.surfaceMuted,
            })}
          >
            <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </Row>

        <Card variant="muted" padding="md" radius="lg">
          <Row justify="space-between" gap="md">
            <Stack flex={1} gap="xxs">
              <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
                {debt.direction === 'i_owe' ? `Je dois à ${personName}` : `${personName} me doit`}
              </Text>
              <Text variant="heading" weight="extrabold" tabular>
                Reste {formatAmount(maxDa)}
              </Text>
            </Stack>
            {maxDa > 0 && (
              <Button label="Tout" variant="outline" size="sm" onPress={fillRemaining} />
            )}
          </Row>
        </Card>

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
              placeholder="Ex. Virement CCP"
              returnKeyType="done"
            />
          </Stack>
        </Row>

        <Stack gap="sm" style={{ paddingTop: spacing.sm }}>
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
            label={repayment ? 'Enregistrer' : 'Ajouter le remboursement'}
            variant="secondary"
            size="lg"
            fullWidth
            onPress={save}
          />
          {repayment && (
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

      {repayment && (
        <ConfirmDialog
          visible={confirmDelete}
          variant="danger"
          title="Supprimer ce remboursement ?"
          message={`Le reste dû augmentera de ${formatAmount(repayment.amountDa)}.`}
          confirmLabel="Supprimer"
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
          error={deleteError}
        />
      )}
    </>
  );
}
