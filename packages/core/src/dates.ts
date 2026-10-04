/**
 * Timezone-free calendar-date helpers.
 *
 * Dates travel through the whole app as ISO strings (`YYYY-MM-DD`). Internally every
 * operation goes through UTC midnight so DST shifts can never move a date by a day.
 */

export type ISODate = string;
export type MonthKey = string; // YYYY-MM

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidISO(value: string): boolean {
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export function parseISO(value: ISODate): Date {
  const m = ISO_RE.exec(value);
  if (!m) throw new Error(`Invalid ISO date: ${value}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function toISO(date: Date): ISODate {
  const y = date.getUTCFullYear().toString().padStart(4, '0');
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = date.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function makeISO(year: number, month: number, day: number): ISODate {
  return toISO(new Date(Date.UTC(year, month - 1, day)));
}

export function addDays(value: ISODate, days: number): ISODate {
  const date = parseISO(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toISO(date);
}

/** ISO weekday: Monday = 1 … Sunday = 7. */
export function weekdayOf(value: ISODate): number {
  const day = parseISO(value).getUTCDay();
  return day === 0 ? 7 : day;
}

export function isWeekend(value: ISODate): boolean {
  return weekdayOf(value) >= 6;
}

export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function monthKeyOf(value: ISODate): MonthKey {
  return value.slice(0, 7);
}

export function yearOf(value: ISODate): number {
  return Number(value.slice(0, 4));
}

export function daysInMonth(key: MonthKey): number {
  const [y, m] = key.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthRange(key: MonthKey): { from: ISODate; to: ISODate } {
  return { from: `${key}-01`, to: `${key}-${String(daysInMonth(key)).padStart(2, '0')}` };
}

export function nextMonthKey(key: MonthKey): MonthKey {
  const [y, m] = key.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

export function formatDM(value: ISODate): string {
  return `${value.slice(8, 10)}.${value.slice(5, 7)}`;
}

export function formatDMY(value: ISODate): string {
  return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`;
}

export const MONTH_NAMES_PL = [
  'styczeń',
  'luty',
  'marzec',
  'kwiecień',
  'maj',
  'czerwiec',
  'lipiec',
  'sierpień',
  'wrzesień',
  'październik',
  'listopad',
  'grudzień',
] as const;

export const WEEKDAY_SHORT_PL = ['Pn', 'Wt', 'Śr', 'Czw', 'Pt'] as const;
export const WEEKDAY_LONG_PL = [
  'poniedziałek',
  'wtorek',
  'środa',
  'czwartek',
  'piątek',
  'sobota',
  'niedziela',
] as const;

export function monthLabel(key: MonthKey): string {
  const [y, m] = key.split('-').map(Number) as [number, number];
  const name = MONTH_NAMES_PL[m - 1] ?? key;
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}
