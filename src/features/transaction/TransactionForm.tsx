import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useRef, useState } from 'react';
import { Pressable } from 'react-native';

import {
  Button,
  FormScrollView,
  Input,
  Row,
  Skeleton,
  Stack,
  Text,
  useSheet,
  useTheme,
} from '@/design-system';
import type { Database } from '@/db/client';
import { useDatabase } from '@/db/DatabaseProvider';
import { useUserId } from '@/features/auth/AuthProvider';
import { CategoriesReadError } from '@/features/categories/components/CategoriesReadError';
import { useCategories } from '@/features/categories/useCategories';
import { LoadingRegion } from '@/features/sync/components/Skeletons';
import { toIsoDate } from '@/lib/format';
import {
  amountToInput,
  eurCentsToDa,
  parseDecimal,
  parseEurCents,
  toDecimalInput,
} from '@/lib/money';
import {
  isUnchanged,
  NOTE_MAX_LENGTH,
  type TransactionErrors,
  validateTransaction,
} from '@/lib/transactions';
import { getLastEurRate, saveLastEurRate } from '@/repositories/settings';
import { createTransaction, updateTransaction } from '@/repositories/transactions';
import { RowNotFoundError } from '@/repositories/write';
import type { Currency, Transaction, TransactionType } from '@/types/budget';

import { AmountInput } from './components/AmountInput';
import { CategoryGrid } from './components/CategoryGrid';
import { DateField } from './components/DateField';
import { DeleteTransactionDialog } from './components/DeleteTransactionDialog';
import { EurRateField } from './components/EurRateField';

type Props = { mode: 'new'; type: TransactionType } | { mode: 'edit'; transaction: Transaction };

type Errors = TransactionErrors & { submit?: string };

const GRID_COLUMNS = 3;
const GRID_SIZE = 9;

// Dernier taux saisi ; un échec de lecture ne fait que perdre le préremplissage.
function readLastEurRate(db: Database, userId: string): number | null {
  try {
    return getLastEurRate(db, userId);
  } catch (error) {
    console.error('[db] Lecture du dernier taux impossible', error);
    return null;
  }
}

// Formulaire d'ajout / modification d'une entrée ou d'une dépense (feuille aux 2/3).
// Initialisé une seule fois : une mise à jour reçue pendant la saisie (synchro) ne l'écrase pas.
export function TransactionForm(props: Props) {
  const { colors, spacing, radius } = useTheme();
  const { close } = useSheet();
  const db = useDatabase();
  const userId = useUserId();
  const categories = useCategories();
  const existing = props.mode === 'edit' ? props.transaction : null;
  const type = existing ? existing.type : props.mode === 'new' ? props.type : 'expense';
  const isExpense = type === 'expense';
  const today = toIsoDate(new Date());

  const [amount, setAmount] = useState(existing ? amountToInput(existing) : '');
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? 'DZD');
  // Taux de la transaction, sinon dernier taux saisi ; jamais de valeur par défaut.
  const [rate, setRate] = useState(() => {
    const initial = existing?.eurRate ?? readLastEurRate(db, userId);
    return initial !== null ? toDecimalInput(initial) : '';
  });
  const [date, setDate] = useState(existing?.date ?? today);
  const [note, setNote] = useState(existing?.note ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saving = useRef(false);

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
    if (saving.current) return;
    // Catégories pas encore lues (ou illisibles) : la dépense ne peut pas être validée.
    if (isExpense && categories.status !== 'ready') return;
    const categoryIds = new Set(
      categories.status === 'ready' ? categories.data.map((c) => c.id) : [],
    );
    const result = validateTransaction(
      { type, amount, currency, rate, date, categoryId, note },
      { today: toIsoDate(new Date()), categoryIds },
    );
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    saving.current = true;
    // Rien de modifié : aucune écriture (pas d'entrée inutile dans la file de synchro).
    if (existing && isUnchanged(existing, result.values)) {
      close();
      return;
    }
    try {
      if (existing) updateTransaction(db, userId, existing.id, result.values);
      else createTransaction(db, userId, result.values);
    } catch (error) {
      saving.current = false;
      console.error("[db] Échec de l'enregistrement de la transaction", error);
      setErrors({
        submit:
          error instanceof RowNotFoundError
            ? "Cette transaction n'existe plus."
            : "L'enregistrement a échoué. Réessaie.",
      });
      return;
    }
    if (result.values.eurRate !== null) {
      // Transaction déjà enregistrée : un échec ici ne fait que perdre le préremplissage.
      try {
        saveLastEurRate(db, userId, result.values.eurRate);
      } catch (error) {
        console.error('[db] Dernier taux non mémorisé', error);
      }
    }
    close();
  };

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
            onChange={(v) => {
              setDate(v);
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
            placeholder="Ex. Taxi aéroport"
            maxLength={NOTE_MAX_LENGTH}
            returnKeyType="done"
          />
        </Stack>
      </Row>

      {isExpense &&
        (categories.status === 'ready' ? (
          <CategoryGrid
            categories={categories.data}
            value={categoryId}
            onChange={(id) => {
              setCategoryId(id);
              clearError('category');
            }}
            error={errors.category}
          />
        ) : categories.status === 'error' ? (
          <CategoriesReadError />
        ) : (
          <CategoryGridSkeleton />
        ))}

      <Stack gap="sm" style={{ paddingTop: spacing.sm }}>
        {errors.submit ? (
          <Text variant="bodySmall" color="danger" align="center" accessibilityLiveRegion="polite">
            {errors.submit}
          </Text>
        ) : null}
        <Button label={submitLabel} variant="secondary" size="lg" fullWidth onPress={save} />
        {existing && (
          <Button
            label="Supprimer"
            variant="danger"
            size="lg"
            fullWidth
            onPress={() => setConfirmDelete(true)}
          />
        )}
      </Stack>
      {existing && (
        <DeleteTransactionDialog
          key={confirmDelete ? 'open' : 'closed'}
          transaction={confirmDelete ? existing : null}
          onCancel={() => setConfirmDelete(false)}
          onDeleted={() => {
            setConfirmDelete(false);
            close();
          }}
        />
      )}
    </FormScrollView>
  );
}

// Grille 3×3 pendant la lecture des catégories (libellé fixe, tuiles remplacées).
function CategoryGridSkeleton() {
  const { spacing } = useTheme();
  return (
    <Stack gap="sm">
      <Text variant="label" color="textSecondary">
        Sélectionner une catégorie
      </Text>
      <LoadingRegion>
        <Row wrap style={{ marginHorizontal: -spacing.xs }}>
          {Array.from({ length: GRID_SIZE }, (_, i) => (
            <Stack key={i} style={{ width: `${100 / GRID_COLUMNS}%`, padding: spacing.xs }}>
              <Skeleton radius="lg" style={{ aspectRatio: 1, height: undefined }} />
            </Stack>
          ))}
        </Row>
      </LoadingRegion>
    </Stack>
  );
}
