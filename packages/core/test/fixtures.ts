import {
  DEFAULT_CUSTOM_DAYS,
  DEFAULT_SETTINGS,
  buildCalendar,
  createDefaultPlan,
  type Calendar,
  type Settings,
  type TeacherPlan,
} from '../src';

export function defaultCalendar(settings: Settings = DEFAULT_SETTINGS): Calendar {
  return buildCalendar({ settings, customDays: DEFAULT_CUSTOM_DAYS });
}

export function plan(overrides: Partial<TeacherPlan> = {}): TeacherPlan {
  return { ...createDefaultPlan(DEFAULT_SETTINGS), ...overrides };
}

/** Same hours on each weekday. */
export function flat(hours: number): number[] {
  return [hours, hours, hours, hours, hours];
}
