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

const toIsoDate = (d: Date) =>
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
