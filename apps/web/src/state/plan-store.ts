import {
  createDefaultPlan,
  DEFAULT_SETTINGS,
  teacherPlanSchema,
  type GroupId,
  type MonthlyAdjustments,
  type TeacherEvent,
  type TeacherPlan,
} from '@nadgodziny/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '../lib/safe-storage';

type TimetableRow = GroupId | 'ind';

interface PlanState {
  plan: TeacherPlan;
  patch: (patch: Partial<TeacherPlan>) => void;
  setPensumFull: (hours: number) => void;
  setContractHours: (hours: number) => void;
  setTimetableCell: (row: TimetableRow, day: number, hours: number) => void;
  setTimetableRow: (row: TimetableRow, values: number[]) => void;
  setOverride: (date: string, value: string | null) => void;
  clearOverrides: (dates?: string[]) => void;
  addEvent: (event: TeacherEvent) => void;
  updateEvent: (id: string, patch: Partial<TeacherEvent>) => void;
  removeEvent: (id: string) => void;
  setMonthly: (monthKey: string, patch: MonthlyAdjustments) => void;
  unsetMonthly: (monthKey: string, field: keyof MonthlyAdjustments) => void;
  replacePlan: (plan: TeacherPlan) => void;
  reset: (defaultPensum?: number) => void;
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      plan: createDefaultPlan(DEFAULT_SETTINGS),

      patch: (patch) => set((s) => ({ plan: { ...s.plan, ...patch } })),

      setPensumFull: (hours) =>
        set((s) => {
          const wasFull = s.plan.contractHours === s.plan.pensumFull;
          return {
            plan: {
              ...s.plan,
              pensumFull: hours,
              contractHours: wasFull ? hours : Math.min(s.plan.contractHours, hours),
            },
          };
        }),

      setContractHours: (hours) => set((s) => ({ plan: { ...s.plan, contractHours: hours } })),

      setTimetableCell: (row, day, hours) =>
        set((s) => {
          const next = [...s.plan.timetable[row]];
          next[day] = hours;
          return { plan: { ...s.plan, timetable: { ...s.plan.timetable, [row]: next } } };
        }),

      setTimetableRow: (row, values) =>
        set((s) => ({ plan: { ...s.plan, timetable: { ...s.plan.timetable, [row]: values } } })),

      setOverride: (date, value) =>
        set((s) => {
          const cellOverrides = { ...s.plan.cellOverrides };
          if (value === null) delete cellOverrides[date];
          else cellOverrides[date] = value;
          return { plan: { ...s.plan, cellOverrides } };
        }),

      clearOverrides: (dates) =>
        set((s) => {
          if (!dates) return { plan: { ...s.plan, cellOverrides: {} } };
          const cellOverrides = { ...s.plan.cellOverrides };
          for (const d of dates) delete cellOverrides[d];
          return { plan: { ...s.plan, cellOverrides } };
        }),

      addEvent: (event) => set((s) => ({ plan: { ...s.plan, events: [...s.plan.events, event] } })),

      updateEvent: (id, patch) =>
        set((s) => ({
          plan: { ...s.plan, events: s.plan.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) },
        })),

      removeEvent: (id) =>
        set((s) => ({ plan: { ...s.plan, events: s.plan.events.filter((e) => e.id !== id) } })),

      setMonthly: (monthKey, patch) =>
        set((s) => ({
          plan: {
            ...s.plan,
            monthly: { ...s.plan.monthly, [monthKey]: { ...s.plan.monthly[monthKey], ...patch } },
          },
        })),

      unsetMonthly: (monthKey, field) =>
        set((s) => {
          const { [field]: _removed, ...rest } = s.plan.monthly[monthKey] ?? {};
          void _removed;
          return { plan: { ...s.plan, monthly: { ...s.plan.monthly, [monthKey]: rest } } };
        }),

      replacePlan: (plan) => set({ plan }),

      reset: (defaultPensum = DEFAULT_SETTINGS.defaultPensum) =>
        set({ plan: createDefaultPlan({ defaultPensum }) }),
    }),
    {
      name: 'nadgodziny:plan:v1',
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: (k) => safeStorage.getItem(k),
        setItem: (k, v) => safeStorage.setItem(k, v),
        removeItem: (k) => safeStorage.removeItem(k),
      })),
      partialize: (s) => ({ plan: s.plan }),
      // Stored data is untrusted input: validate it and fall back to a clean plan.
      merge: (persisted, current) => {
        const candidate = (persisted as { plan?: unknown } | undefined)?.plan;
        const parsed = teacherPlanSchema.safeParse(candidate);
        return parsed.success ? { ...current, plan: parsed.data } : current;
      },
    },
  ),
);
