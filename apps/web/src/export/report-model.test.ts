import {
  DEFAULT_CUSTOM_DAYS,
  DEFAULT_SETTINGS,
  buildCalendar,
  calculate,
  createDefaultPlan,
  createEvent,
  emptyTimetable,
} from '@nadgodziny/core';
import { describe, expect, it } from 'vitest';
import { buildReport } from './report-model';

const calendar = buildCalendar({ settings: DEFAULT_SETTINGS, customDays: DEFAULT_CUSTOM_DAYS });
const plan = {
  ...createDefaultPlan(DEFAULT_SETTINGS),
  teacherName: 'Zażółć Gęślą',
  variant: 2 as const,
  timetable: {
    ...emptyTimetable(),
    k12: [2, 2, 2, 2, 2],
    k34: [2, 2, 2, 2, 2],
    k5: [1, 1, 1, 1, 1],
    ind: [1, 0, 0, 0, 0],
  },
  events: [{ ...createEvent('e1', 'trip', '2026-10-20'), paidHours: 8 }],
};

describe('report model', () => {
  const result = calculate(plan, DEFAULT_SETTINGS, calendar);
  const report = buildReport(
    plan,
    DEFAULT_SETTINGS,
    calendar,
    result,
    new Date('2026-10-05T10:00:00'),
  );

  it('names files without diacritics', () => {
    expect(report.fileBaseName).toBe('nadgodziny-zazolc-gesla-2026-2027');
  });

  it('mirrors the paper table: 48 rows in 10 months, five cells each', () => {
    expect(report.weeklyMonths).toHaveLength(10);
    const rows = report.weeklyMonths.flatMap((m) => m.rows);
    expect(rows).toHaveLength(48);
    expect(rows.every((r) => r.cells.length === 5)).toBe(true);
  });

  it('writes individual hours separately so they can be printed green', () => {
    const first = report.weeklyMonths[0]!.rows[1]!; // 07.09 – 11.09.2026, Monday has 5 + 1
    expect(first.cells[0]).toMatchObject({ regular: '5', individual: '1', kind: 'school' });
  });

  it('flags grey, yellow and out-of-segment cells', () => {
    const rows = report.weeklyMonths.flatMap((m) => m.rows);
    const oct = rows.find((r) => r.label === '12.10 – 16.10.2026')!;
    expect(oct.cells[2]!.kind).toBe('off'); // 14.10
    const may = rows.find((r) => r.label === '03.05 – 07.05.2027')!;
    expect(may.cells.map((c) => c.kind)).toEqual(['off', 'exam', 'exam', 'exam', 'exam']);
    const first = rows[0]!;
    expect(first.cells[0]!.kind).toBe('void'); // Monday 31.08 is not part of September
  });

  it('adds up the monthly table to the headline total', () => {
    const overtimeColumn = report.monthlyLines.reduce(
      (acc, l) => acc + Number(l.cells[0]!.replace('—', '0')),
      0,
    );
    expect(overtimeColumn).toBe(result.selected.overtimeTotal);
    expect(report.events).toHaveLength(1);
    expect(report.events[0]!.settlement).toContain('8 godz.');
  });

  it('includes the school notes with the configured class-5 date', () => {
    expect(report.notes.some((n) => n.includes('30.04.2027'))).toBe(true);
  });
});
