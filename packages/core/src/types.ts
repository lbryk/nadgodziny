import type { ISODate, MonthKey } from './dates';

/* ---------------------------------------------------------------------------------------------
 * Calendar
 * ------------------------------------------------------------------------------------------- */

/** What a calendar date is, from the school-timetable point of view. */
export type DayKind =
  | 'school' // regular teaching day
  | 'weekend'
  | 'outside' // before the first / after the last teaching day (wakacje)
  | 'holiday' // statutory public holiday
  | 'break' // winter / spring (Easter) break
  | 'ferie' // ferie zimowe
  | 'den' // Dzień Edukacji Narodowej
  | 'director' // extra day off decided by the headteacher
  | 'exam' // exam day – overtime is not paid
  | 'other'; // any other day off

export type CalendarDaySource = 'rule' | 'school' | 'admin';

export interface CalendarDay {
  date: ISODate;
  kind: DayKind;
  label?: string;
  source: CalendarDaySource;
}

/** A day entered by the administrator (or shipped as school default) that overrides the rules. */
export interface CustomDay {
  date: ISODate;
  kind: Exclude<DayKind, 'weekend' | 'outside'>;
  label?: string;
}

export interface DateRange {
  from: ISODate;
  to: ISODate;
}

/** One row of the settlement table: a Mon–Fri week clipped to a single calendar month. */
export interface WeekRow {
  id: string;
  monthKey: MonthKey;
  from: ISODate;
  to: ISODate;
  label: string;
  /** Always five entries (Mon…Fri). `date` is null where the day is outside this row's segment. */
  cells: RowCell[];
}

export interface RowCell {
  date: ISODate | null;
  kind: DayKind | 'void';
  label?: string;
}

export interface MonthInfo {
  key: MonthKey;
  label: string;
  /** Mon–Fri minus statutory holidays across the whole calendar month. */
  workdays: number;
  /** Days on which lessons take place (kind = school), exam days not included. */
  teachingDays: number;
  firstDate: ISODate;
  lastDate: ISODate;
}

export interface Calendar {
  label: string; // e.g. 2026/2027
  startYear: number;
  startDate: ISODate;
  endDate: ISODate;
  days: Record<ISODate, CalendarDay>;
  rows: WeekRow[];
  months: MonthInfo[];
}

/* ---------------------------------------------------------------------------------------------
 * Settings (editable by the administrator)
 * ------------------------------------------------------------------------------------------- */

export type RoundingMode = 'nearest' | 'up' | 'down';
export type WorkdaysBasis = 'working-days' | 'school-days';
export type AbsenceCounting = 'lesson-days' | 'all-days';
export type ExamDayPolicy = 'neutral' | 'normal';

export type Voivodeship =
  | 'dolnoslaskie'
  | 'kujawsko-pomorskie'
  | 'lubelskie'
  | 'lubuskie'
  | 'lodzkie'
  | 'malopolskie'
  | 'mazowieckie'
  | 'opolskie'
  | 'podkarpackie'
  | 'podlaskie'
  | 'pomorskie'
  | 'slaskie'
  | 'swietokrzyskie'
  | 'warminsko-mazurskie'
  | 'wielkopolskie'
  | 'zachodniopomorskie';

export interface Weights {
  /** Hours in classes 1 and 2 (full school year, weight 1). */
  k12: number;
  /** Hours in classes 3 and 4 (practical training removes ~10 % of the year). */
  k34: number;
  /** Hours in classes 5 (lessons end 30 April). */
  k5: number;
  /** Individual teaching counted into the contract (only for part-time teachers who have it inside). */
  individual: number;
}

export interface Settings {
  schoolName: string;
  /** Calendar year in which the school year starts, i.e. 2026 for 2026/2027. */
  schoolYearStart: number;
  voivodeship: Voivodeship;
  denIsDayOff: boolean;
  weights: Weights;
  weeksPerMonth: number;
  rounding: RoundingMode;
  workdaysBasis: WorkdaysBasis;
  absenceCounting: AbsenceCounting;
  examDays: ExamDayPolicy;
  class5EndDate: ISODate;
  pensumPresets: number[];
  defaultPensum: number;
  /** ISO local date-time (YYYY-MM-DDTHH:mm) or empty. */
  submissionDeadline: string;
  /** Short banner shown on the calculator, e.g. a timetable change notice. */
  announcement: string;
}

/* ---------------------------------------------------------------------------------------------
 * Teacher input
 * ------------------------------------------------------------------------------------------- */

export type GroupId = 'k12' | 'k34' | 'k5';
export const GROUP_IDS: readonly GroupId[] = ['k12', 'k34', 'k5'] as const;

/** Weekly timetable: hours per weekday (Mon…Fri) for each group of classes. */
export interface Timetable {
  k12: number[];
  k34: number[];
  k5: number[];
  /** Individual teaching (nauczanie indywidualne). */
  ind: number[];
}

export type EventKind =
  | 'trip'
  | 'training'
  | 'absence'
  | 'practice'
  | 'exam-oral'
  | 'exam-assist'
  | 'substitution'
  | 'individual'
  | 'other';

export type LessonsEffect = 'none' | 'whole-day' | 'partial' | 'groups';
export type Settlement = 'none' | 'separate' | 'free';

export interface TeacherEvent {
  id: string;
  kind: EventKind;
  title: string;
  from: ISODate;
  to: ISODate;
  /** How the event changes the lessons that were scheduled in the timetable. */
  lessons: LessonsEffect;
  /** Lessons not held per day – used with `lessons: 'partial'`. */
  hoursPerDay: number;
  /** Groups whose lessons are dropped – used with `lessons: 'groups'` (e.g. practical training). */
  groups: GroupId[];
  /** `separate` = settled outside the averaged overtime, `free` = done inside the 40 h week (unpaid). */
  settlement: Settlement;
  /** Hours settled separately (attributed to the month of `from`). */
  paidHours: number;
  note: string;
}

export interface MonthlyAdjustments {
  substitutions?: number;
  individual?: number;
  absenceDays?: number;
}

export interface TeacherPlan {
  teacherName: string;
  variant: 1 | 2;
  /** Full-time weekly pensum for this kind of employment (18, 20, 22, 30 …). */
  pensumFull: number;
  /** Weekly hours stated in the contract (equals pensumFull for a full-time job). */
  contractHours: number;
  /** Individual teaching is part of the contract – it has to be worked off, never paid extra. */
  individualInPensum: boolean;
  timetable: Timetable;
  /** Manual cell overrides, e.g. `"3+1"`. Keyed by date. */
  cellOverrides: Record<ISODate, string>;
  events: TeacherEvent[];
  monthly: Record<MonthKey, MonthlyAdjustments>;
  /** Manual averaged weekly pensum (variant 2). `null` = computed automatically. */
  avgPensumOverride: number | null;
  /** Optional hourly rate used only for a PLN estimate. */
  hourlyRate: number | null;
}
