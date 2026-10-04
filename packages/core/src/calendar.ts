import {
  addDays,
  eachDay,
  formatDM,
  formatDMY,
  isWeekend,
  makeISO,
  monthKeyOf,
  monthLabel,
  monthRange,
  nextMonthKey,
  weekdayOf,
  type ISODate,
  type MonthKey,
} from './dates';
import { publicHolidays, easterSunday } from './holidays';
import { feriePreset } from './presets';
import type {
  Calendar,
  CalendarDay,
  CustomDay,
  DateRange,
  DayKind,
  MonthInfo,
  RowCell,
  Settings,
  WeekRow,
} from './types';

export const DAY_KIND_LABEL: Record<DayKind, string> = {
  school: 'Dzień zajęć',
  weekend: 'Weekend',
  outside: 'Poza rokiem szkolnym',
  holiday: 'Święto ustawowo wolne',
  break: 'Przerwa świąteczna',
  ferie: 'Ferie zimowe',
  den: 'Dzień Edukacji Narodowej',
  director: 'Dzień wolny (dyrektor)',
  exam: 'Egzaminy',
  other: 'Inny dzień wolny',
};

/** Kinds that can be assigned from the administrator form. */
export const EDITABLE_KINDS: Exclude<DayKind, 'weekend' | 'outside'>[] = [
  'holiday',
  'break',
  'ferie',
  'den',
  'director',
  'exam',
  'other',
  'school',
];

/** A weekday on which lessons are held and hours can be entered. */
export function isTeachingKind(kind: DayKind | 'void'): boolean {
  return kind === 'school';
}

/** Days where the teacher can type hours (teaching days and exam days). */
export function isEditableKind(kind: DayKind | 'void'): boolean {
  return kind === 'school' || kind === 'exam';
}

/** First working day of September (if 1 September is Fri/Sat/Sun → following Monday). */
export function schoolYearStartDate(startYear: number): ISODate {
  const sept1 = makeISO(startYear, 9, 1);
  const wd = weekdayOf(sept1);
  if (wd <= 4) return sept1;
  return addDays(sept1, 8 - wd);
}

/** Last teaching day: the first Friday after 20 June. */
export function schoolYearEndDate(startYear: number): ISODate {
  const jun20 = makeISO(startYear + 1, 6, 20);
  const wd = weekdayOf(jun20);
  const diff = (5 - wd + 7) % 7;
  return addDays(jun20, diff === 0 ? 7 : diff);
}

export function winterBreak(startYear: number): DateRange {
  return { from: makeISO(startYear, 12, 23), to: makeISO(startYear, 12, 31) };
}

/** Spring break: Thursday before Easter through Tuesday after Easter. */
export function easterBreak(startYear: number): DateRange {
  const easter = easterSunday(startYear + 1);
  return { from: addDays(easter, -3), to: addDays(easter, 2) };
}

function rangeContains(range: DateRange | null, date: ISODate): boolean {
  return !!range && date >= range.from && date <= range.to;
}

export interface CalendarInput {
  settings: Pick<Settings, 'schoolYearStart' | 'voivodeship' | 'denIsDayOff'>;
  customDays: CustomDay[];
}

export function buildCalendar({ settings, customDays }: CalendarInput): Calendar {
  const startYear = settings.schoolYearStart;
  const startDate = schoolYearStartDate(startYear);
  const endDate = schoolYearEndDate(startYear);
  const winter = winterBreak(startYear);
  const spring = easterBreak(startYear);
  const ferie = feriePreset(startYear, settings.voivodeship);
  const holidays = { ...publicHolidays(startYear), ...publicHolidays(startYear + 1) };
  const denDate = makeISO(startYear, 10, 14);
  const custom = new Map<ISODate, CustomDay>();
  for (const c of customDays) custom.set(c.date, c);

  const rangeFrom = makeISO(startYear, 9, 1);
  const rangeTo = makeISO(startYear + 1, 6, 30);
  const days: Record<ISODate, CalendarDay> = {};

  for (const date of eachDay(rangeFrom, rangeTo)) {
    days[date] = classifyDay(date);
  }

  function classifyDay(date: ISODate): CalendarDay {
    const override = custom.get(date);
    if (override) {
      return {
        date,
        kind: override.kind,
        label: override.label ?? DAY_KIND_LABEL[override.kind],
        source: 'admin',
      };
    }
    const holiday = holidays[date];
    if (holiday) return { date, kind: 'holiday', label: holiday, source: 'rule' };
    if (settings.denIsDayOff && date === denDate) {
      return { date, kind: 'den', label: DAY_KIND_LABEL.den, source: 'rule' };
    }
    if (rangeContains(winter, date)) {
      return { date, kind: 'break', label: 'Zimowa przerwa świąteczna', source: 'rule' };
    }
    if (rangeContains(spring, date)) {
      return { date, kind: 'break', label: 'Wiosenna przerwa świąteczna', source: 'rule' };
    }
    if (rangeContains(ferie, date)) {
      return { date, kind: 'ferie', label: DAY_KIND_LABEL.ferie, source: 'rule' };
    }
    if (isWeekend(date)) return { date, kind: 'weekend', source: 'rule' };
    if (date < startDate || date > endDate) {
      return { date, kind: 'outside', label: 'Wakacje', source: 'rule' };
    }
    return { date, kind: 'school', source: 'rule' };
  }

  const rows = buildRows(days, startDate, endDate);
  const months = buildMonths(startYear, days, holidays, customDays);

  return {
    label: `${startYear}/${startYear + 1}`,
    startYear,
    startDate,
    endDate,
    days,
    rows,
    months,
  };
}

/** Mon–Fri weeks, split on month boundaries — the same layout as the paper table. */
function buildRows(
  days: Record<ISODate, CalendarDay>,
  startDate: ISODate,
  endDate: ISODate,
): WeekRow[] {
  const dates = Object.keys(days).sort();
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;
  // Monday of the week that contains the first day
  let monday = addDays(first, -(weekdayOf(first) - 1));
  const rows: WeekRow[] = [];

  while (monday <= endDate) {
    const weekdays = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
    // split into month segments
    const segments: ISODate[][] = [];
    for (const d of weekdays) {
      const prev = segments[segments.length - 1];
      if (prev && monthKeyOf(prev[0]!) === monthKeyOf(d)) prev.push(d);
      else segments.push([d]);
    }
    for (const seg of segments) {
      const segFirst = seg[0]!;
      const segLast = seg[seg.length - 1]!;
      if (segLast < first || segFirst > last || segFirst > endDate) continue;
      const cells: RowCell[] = weekdays.map((d) => {
        if (!seg.includes(d)) return { date: null, kind: 'void' as const };
        const day = days[d];
        return { date: d, kind: day?.kind ?? 'outside', label: day?.label };
      });
      rows.push({
        id: segFirst,
        monthKey: monthKeyOf(segFirst),
        from: segFirst,
        to: segLast,
        label: rowLabel(segFirst, segLast),
        cells,
      });
    }
    monday = addDays(monday, 7);
  }
  return rows;
}

function rowLabel(from: ISODate, to: ISODate): string {
  if (from === to) return formatDMY(from);
  return `${formatDM(from)} – ${formatDMY(to)}`;
}

function buildMonths(
  startYear: number,
  days: Record<ISODate, CalendarDay>,
  holidays: Record<ISODate, string>,
  customDays: CustomDay[],
): MonthInfo[] {
  const customHolidays = new Set(customDays.filter((c) => c.kind === 'holiday').map((c) => c.date));
  const customWorking = new Set(customDays.filter((c) => c.kind === 'school').map((c) => c.date));
  const months: MonthInfo[] = [];
  let key: MonthKey = `${startYear}-09`;
  const endKey: MonthKey = `${startYear + 1}-06`;
  while (key <= endKey) {
    const { from, to } = monthRange(key);
    let workdays = 0;
    let teachingDays = 0;
    for (const d of eachDay(from, to)) {
      if (isWeekend(d)) continue;
      const isHoliday =
        (holidays[d] !== undefined && !customWorking.has(d)) || customHolidays.has(d);
      if (!isHoliday) workdays += 1;
      if (days[d]?.kind === 'school') teachingDays += 1;
    }
    months.push({
      key,
      label: monthLabel(key),
      workdays,
      teachingDays,
      firstDate: from,
      lastDate: to,
    });
    key = nextMonthKey(key);
  }
  return months;
}

/** Quick lookup helper used by the UI and the calculators. */
export function dayAt(calendar: Calendar, date: ISODate): CalendarDay | undefined {
  return calendar.days[date];
}
