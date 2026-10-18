import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useRef, useState } from 'react';
import { Alert, Pressable } from 'react-native';

import {
  Button,
  FormScrollView,
  Input,
  minTouchTarget,
  Row,
  Stack,
  Text,
  useTheme,
} from '@/design-system';
import { formatAmount, toIsoDate } from '@/lib/format';
import { eurToDa, parseDecimal } from '@/lib/money';
import { MOCK_EUR_RATE, mockCategories } from '@/mocks/budget';
import type { Currency, Transaction, TransactionType } from '@/types/budget';

import { closeSheet } from './closeSheet';
import { AmountInput } from './components/AmountInput';
import { CategoryGrid } from './components/CategoryGrid';
import { DateField } from './components/DateField';

type Props = { mode: 'new'; type: TransactionType } | { mode: 'edit'; transaction: Transaction };

type Errors = Partial<Record<'amount' | 'rate' | 'category' | 'submit', string>>;

// TODO(phase 3) : remplacer par l'écriture SQLite.
const simulateRequest = () => new Promise((resolve) => setTimeout(resolve, 600));

const toInput = (n: number) => String(n).replace('.', ',');

function initialAmount(t: Transaction): string {
  if (t.currency === 'EUR' && t.originalAmountCents !== null)
    return toInput(t.originalAmountCents / 100);
  return String(t.amountDa);
}

// Formulaire d'ajout / modification d'une entrée ou d'une dépense (feuille aux 2/3).
export function TransactionForm(props: Props) {
  const { colors, spacing, radius } = useTheme();
  const existing = props.mode === 'edit' ? props.transaction : null;
  const type = existing ? existing.type : props.mode === 'new' ? props.type : 'expense';
  const isExpense = type === 'expense';

  const [amount, setAmount] = useState(existing ? initialAmount(existing) : '');
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? 'DZD');
  const [rate, setRate] = useState(toInput(existing?.eurRate ?? MOCK_EUR_RATE));
  const [date, setDate] = useState(existing?.date ?? toIsoDate(new Date()));
  const [note, setNote] = useState(existing?.note ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [errors, setErrors] = useState<Errors>({});
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);

  const amountValue = parseDecimal(amount);
  const rateValue = parseDecimal(rate);
  const previewDa =
    currency === 'EUR' && amountValue !== null && rateValue !== null && rateValue > 0
      ? eurToDa(amountValue, rateValue)
      : null;

  const clearError = (key: keyof Errors) =>
    setErrors((e) => (e[key] || e.submit ? { ...e, [key]: undefined, submit: undefined } : e));

  const validate = (): Errors => {
    const next: Errors = {};
    if (amountValue === null || amountValue <= 0) next.amount = 'Saisis un montant supérieur à 0.';
    else if (currency === 'DZD' && !Number.isInteger(amountValue))
      next.amount = 'Le montant en dinars doit être un nombre entier.';
    if (currency === 'EUR' && (rateValue === null || rateValue <= 0))
      next.rate = 'Saisis un taux supérieur à 0.';
    if (isExpense && !categoryId) next.category = 'Choisis une catégorie.';
    return next;
  };

  // Le bouton bloque déjà les appuis tant que la Promise est en cours.
  const save = async () => {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    try {
      await simulateRequest();
      closeSheet();
    } catch {
      setErrors({ submit: "L'enregistrement a échoué. Réessaie." });
    }
  };

  const remove = async () => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    try {
      await simulateRequest();
      closeSheet();
    } catch {
      setErrors({ submit: 'La suppression a échoué. Réessaie.' });
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  const confirmRemove = () =>
    Alert.alert('Supprimer cette transaction ?', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: remove },
    ]);

  const title = existing
    ? isExpense
      ? 'Modifier la dépense'
      : "Modifier l'entrée"
    : isExpense
      ? 'Nouvelle dépense'
      : 'Nouvelle entrée';
  const submitLabel = existing
    ? 'Enregistrer'
    : isExpense
      ? 'Ajouter la dépense'
      : "Ajouter l'entrée";

  return (
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
        <Text variant="title">{title}</Text>
        <Pressable
          onPress={closeSheet}
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
        <Row gap="md" align="flex-start">
          <Stack flex={1}>
            <Input
              label="Taux du jour"
              value={rate}
              onChangeText={(v) => {
                setRate(v);
                clearError('rate');
              }}
              keyboardType="decimal-pad"
              placeholder="250"
              rightIcon={
                <Text variant="bodySmall" color="textMuted">
                  DA / €
                </Text>
              }
              error={errors.rate}
            />
          </Stack>
          <Stack flex={1} gap="xs">
            <Text variant="label" color="textSecondary">
              Soit environ
            </Text>
            <Row style={{ minHeight: minTouchTarget }}>
              <Text variant="heading" weight="extrabold" color="textStrong" tabular>
                {previewDa !== null ? `≈ ${formatAmount(previewDa)}` : '—'}
              </Text>
            </Row>
          </Stack>
        </Row>
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
            placeholder="Ex. Taxi aéroport"
            returnKeyType="done"
          />
        </Stack>
      </Row>

      {isExpense && (
        <CategoryGrid
          categories={mockCategories}
          value={categoryId}
          onChange={(id) => {
            setCategoryId(id);
            clearError('category');
          }}
          error={errors.category}
        />
      )}

      <Stack gap="sm" style={{ paddingTop: spacing.sm }}>
        {errors.submit ? (
          <Text variant="bodySmall" color="danger" align="center" accessibilityLiveRegion="polite">
            {errors.submit}
          </Text>
        ) : null}
        <Button
          label={submitLabel}
          variant="secondary"
          size="lg"
          fullWidth
          onPress={save}
          disabled={deleting}
        />
        {existing && (
          <Button
            label="Supprimer"
            variant="danger"
            size="lg"
            fullWidth
            loading={deleting}
            onPress={confirmRemove}
          />
        )}
      </Stack>
    </FormScrollView>
  );
}
