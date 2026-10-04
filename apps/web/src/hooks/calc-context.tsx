import {
  buildCalendar,
  calculate,
  type CalcResult,
  type Calendar,
  type Settings,
  type TeacherPlan,
} from '@nadgodziny/core';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { usePlanStore } from '../state/plan-store';
import { useConfig } from './use-config';

interface CalcContextValue {
  plan: TeacherPlan;
  settings: Settings;
  calendar: Calendar;
  result: CalcResult;
  configSource: 'server' | 'cached' | 'defaults';
}

const CalcContext = createContext<CalcContextValue | null>(null);

/** One calendar + one calculation per change, shared by every screen. */
export function CalcProvider({ children }: { children: ReactNode }) {
  const { settings, customDays, source } = useConfig();
  const plan = usePlanStore((s) => s.plan);

  const calendar = useMemo(
    () => buildCalendar({ settings, customDays }),
    // only the calendar-relevant settings should rebuild it
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.schoolYearStart, settings.voivodeship, settings.denIsDayOff, customDays],
  );
  const result = useMemo(() => calculate(plan, settings, calendar), [plan, settings, calendar]);
  const value = useMemo(
    () => ({ plan, settings, calendar, result, configSource: source }),
    [plan, settings, calendar, result, source],
  );
  return <CalcContext.Provider value={value}>{children}</CalcContext.Provider>;
}

export function useCalc(): CalcContextValue {
  const ctx = useContext(CalcContext);
  if (!ctx) throw new Error('useCalc must be used inside <CalcProvider>');
  return ctx;
}
