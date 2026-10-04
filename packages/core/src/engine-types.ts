import type { ISODate, MonthKey } from './dates';
import type { DayKind, GroupId, WeekRow } from './types';

export interface DayCalc {
  date: ISODate;
  kind: DayKind;
  /** Takes part in the pensum obligation and in the hour totals. */
  counted: boolean;
  /** Exam day whose hours are not paid (neutral policy). */
  examExcluded: boolean;
  scheduledRegular: number;
  scheduledIndividual: number;
  regular: number;
  individual: number;
  overridden: boolean;
  eventIds: string[];
  /** Fraction of the day the teacher is absent (0…1) – drives the variant-1 deduction. */
  absence: number;
  /** Group hours that were removed because the group no longer meets (class 5 end, practice). */
  droppedGroups: GroupId[];
}

export interface RowCalc {
  row: WeekRow;
  cells: (DayCalc | null)[];
  countedDays: number;
  /** Share of a full week covered by this row (countedDays / 5). */
  weight: number;
  hours: number;
  individualSeparate: number;
  /** Averaged pensum attributable to this row. */
  pensum: number;
  overtime: number;
}

export interface Variant1Month {
  monthKey: MonthKey;
  label: string;
  workdays: number;
  absenceDaysAuto: number;
  absenceDays: number;
  perDay: number;
  deductionRaw: number;
  deduction: number;
  monthlyOvertime: number;
  overtime: number;
}

export interface Variant1Result {
  hours: { k12: number; k34: number; k5: number; individual: number };
  weightedHours: number;
  pensum: number;
  weeklyOvertime: number;
  weeklyShortfall: number;
  monthlyRaw: number;
  monthlyRounded: number;
  months: Variant1Month[];
  total: number;
}

export interface Variant2Month {
  monthKey: MonthKey;
  label: string;
  rows: RowCalc[];
  hours: number;
  pensum: number;
  overtimeRaw: number;
  overtime: number;
}

export interface Variant2Result {
  /** Averaged weekly pensum; null when there is no overtime over the whole year. */
  averagedPensum: number | null;
  averagedPensumSource: 'auto' | 'manual' | 'none';
  annualHours: number;
  annualObligation: number;
  annualSurplus: number;
  weeks: number;
  months: Variant2Month[];
  rows: RowCalc[];
  total: number;
}

export interface ExtraLines {
  substitutions: number;
  individual: number;
  trips: number;
  exams: number;
  other: number;
  /** Hours done inside the 40 h week (not paid) — informational. */
  free: number;
}

export interface MonthResult {
  monthKey: MonthKey;
  label: string;
  v1: Variant1Month;
  v2: Variant2Month;
  extras: ExtraLines;
}

export interface CalcResult {
  pensum: number;
  days: Record<ISODate, DayCalc>;
  v1: Variant1Result;
  v2: Variant2Result;
  months: MonthResult[];
  /** Variant picked by the teacher. */
  selected: { variant: 1 | 2; overtimeTotal: number; extrasTotal: number; grandTotal: number };
}
