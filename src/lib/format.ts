const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// 12500 → "12 500" (séparateur : espace insécable).
export function formatNumber(value: number): string {
  return Math.round(Math.abs(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// 12500 → "12 500 DA" ; signed : "+12 500 DA" / "−12 500 DA".
export function formatAmount(value: number, options: { signed?: boolean } = {}): string {
  const sign = options.signed ? (value < 0 ? '−' : '+') : value < 0 ? '−' : '';
  return `${sign}${formatNumber(value)} DA`;
}

export type YearMonth = { year: number; month: number }; // month : 1–12

export function formatMonth({ month }: YearMonth): string {
  return capitalize(MONTHS[month - 1]);
}

export function formatMonthYear(ym: YearMonth): string {
  return `${formatMonth(ym)} ${ym.year}`;
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function currentYearMonth(now = new Date()): YearMonth {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function isInMonth(date: string, { year, month }: YearMonth): boolean {
  return date.startsWith(`${year}-${String(month).padStart(2, '0')}`);
}

export const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Date de la liste « Détail » : « Aujourd'hui », « Hier » ou « 18 mars ».
export function formatListDate(date: string, now = new Date()): string {
  if (date === toIsoDate(now)) return "Aujourd'hui";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date === toIsoDate(yesterday)) return 'Hier';
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

// "2026-03-26" → "26/03/2026".
export function formatShortDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

// "2026-03-26" → Date locale (minuit).
export function parseIsoDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ISO date-heure → « aujourd'hui à 14:32 », « hier à 09:05 » ou « 18 mars à 18:40 ».
export function formatDateTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const day = formatListDate(toIsoDate(d), now);
  return `${day.charAt(0).toLowerCase()}${day.slice(1)} à ${formatTime(iso)}`;
}

// Heure locale « 14:32 » d'un horodatage ISO.
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// « Yasmine Benali » → « YB ».
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

const MONTHS_SHORT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

// 3 → « mars » ; short : 1 → « janv. ».
export function monthName(month: number, options: { short?: boolean } = {}): string {
  return (options.short ? MONTHS_SHORT : MONTHS)[month - 1];
}

// "2026-11-05" → « 5 novembre 2026 ».
export function formatLongDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// Nombre de jours de `from` à `to` (dates YYYY-MM-DD), négatif si `to` est avant.
export function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / 86_400_000);
}

// 1 → « en retard de 1 jour », 3 → « en retard de 3 jours ».
export function formatLateness(days: number): string {
  return `en retard de ${days} jour${days > 1 ? 's' : ''}`;
}
