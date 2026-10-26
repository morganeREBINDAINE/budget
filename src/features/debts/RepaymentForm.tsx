import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
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
import { useDatabase } from '@/db/DatabaseProvider';
import { useUserId } from '@/features/auth/AuthProvider';
import { AmountInput } from '@/features/transaction/components/AmountInput';
import { DateField } from '@/features/transaction/components/DateField';
import { EurRateField } from '@/features/transaction/components/EurRateField';
import { readLastEurRate, rememberEurRate } from '@/features/transaction/lastEurRate';
import {
  DEBT_NOTE_MAX_LENGTH,
  isRepaymentUnchanged,
  remainingOf,
  type RepaymentErrors,
  validateRepayment,
} from '@/lib/debts';
import { formatAmount, toIsoDate } from '@/lib/format';
import {
  amountToInput,
  eurCentsToDa,
  formatAmountInput,
  parseDecimal,
  parseEurCents,
  toDecimalInput,
} from '@/lib/money';
import { createRepayment, deleteRepayment, updateRepayment } from '@/repositories/debts';
import { RowNotFoundError } from '@/repositories/write';
import type { Currency, Debt, DebtRepayment } from '@/types/budget';

type Props = {
  debt: Debt;
  personName: string | undefined;
  // Total des remboursements de la dette (lecture en direct), y compris celui modifié.
  repaidDa: number;
  repayment?: DebtRepayment;
};

type Errors = RepaymentErrors & { submit?: string };

// Feuille d'ajout / modification d'un remboursement partiel (aucun lien avec le budget).
export function RepaymentForm({ debt, personName = 'cette personne', repaidDa, repayment }: Props) {
  const { colors, spacing, radius } = useTheme();
  const { close } = useSheet();
  const db = useDatabase();
  const userId = useUserId();
  const writing = useRef(false);
  const today = toIsoDate(new Date());
  // En modification, le remboursement en cours ne compte pas dans le reste dû autorisé.
  const maxDa = remainingOf(debt.amountDa, repaidDa - (repayment?.amountDa ?? 0));

  const [amount, setAmount] = useState(repayment ? amountToInput(repayment) : '');
  const [currency, setCurrency] = useState<Currency>(repayment?.currency ?? 'DZD');
  // Taux du remboursement, sinon dernier taux saisi ; jamais de valeur par défaut.
  const [rate, setRate] = useState(() => {
    const initial = repayment?.eurRate ?? readLastEurRate(db, userId);
    return initial !== null ? toDecimalInput(initial) : '';
  });
  const [date, setDate] = useState(repayment?.date ?? today);
  const [note, setNote] = useState(repayment?.note ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    const result = validateRepayment(
      { amount, currency, rate, date, note },
      { today: toIsoDate(new Date()), maxDa },
    );
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    writing.current = true;
    // Rien de modifié : aucune écriture (pas d'entrée inutile dans la file de synchro).
    if (repayment && isRepaymentUnchanged(repayment, result.values)) {
      close();
      return;
    }
    try {
      if (repayment) updateRepayment(db, userId, repayment.id, result.values);
      else createRepayment(db, userId, debt.id, result.values);
    } catch (error) {
      writing.current = false;
      console.error("[db] Échec de l'enregistrement du remboursement", error);
      setErrors({
        submit:
          error instanceof RowNotFoundError
            ? repayment
              ? "Ce remboursement n'existe plus."
              : "Cette dette n'existe plus."
            : "L'enregistrement a échoué. Réessaie.",
      });
      return;
    }
    // Remboursement déjà enregistré : un échec ici ne fait que perdre le préremplissage.
    rememberEurRate(db, userId, result.values.eurRate);
    close();
  };

  const remove = () => {
    if (!repayment || writing.current) return;
    writing.current = true;
    setDeleteError(null);
    try {
      deleteRepayment(db, userId, repayment.id);
    } catch (error) {
      // Déjà supprimé (ex. par une synchro) : le résultat attendu est atteint.
      if (!(error instanceof RowNotFoundError)) {
        writing.current = false;
        console.error('[db] Échec de la suppression du remboursement', error);
        setDeleteError('La suppression a échoué. Réessaie.');
        return;
      }
    }
    setConfirmDelete(false);
    close();
  };

  const fillRemaining = () => {
    setCurrency('DZD');
    setAmount(formatAmountInput(String(maxDa)));
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
              placeholder="Ex. Virement CCP"
              maxLength={DEBT_NOTE_MAX_LENGTH}
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
