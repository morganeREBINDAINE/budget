import { Input, minTouchTarget, Row, Stack, Text } from '@/design-system';
import { formatAmount } from '@/lib/format';

type Props = {
  rate: string;
  onChangeRate: (value: string) => void;
  // Montant converti, null si la saisie est incomplète.
  previewDa: number | null;
  error?: string;
};

// Champ « Taux du jour » (DA / €) et aperçu indicatif du montant en dinars.
export function EurRateField({ rate, onChangeRate, previewDa, error }: Props) {
  return (
    <Row gap="md" align="flex-start">
      <Stack flex={1}>
        <Input
          label="Taux du jour"
          value={rate}
          onChangeText={onChangeRate}
          keyboardType="decimal-pad"
          placeholder="250"
          rightIcon={
            <Text variant="bodySmall" color="textMuted">
              DA / €
            </Text>
          }
          error={error}
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
  );
}
