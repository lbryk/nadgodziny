import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  calculate,
  createEvent,
  effectivePensum,
  emptyTimetable,
  formatCell,
  parseCell,
  roundHours,
  solveAveragedPensum,
  variant1Core,
  variant1Deduction,
  weightedHours,
  type Settings,
  type TeacherPlan,
} from '../src';
import { defaultCalendar, flat, plan } from './fixtures';

const calendar = defaultCalendar();

function run(p: TeacherPlan, settings: Settings = DEFAULT_SETTINGS) {
  return calculate(p, settings, defaultCalendar(settings));
}

describe('cell notation', () => {
  it('parses plain and individual hours', () => {
    expect(parseCell('3')).toEqual({ ok: true, regular: 3, individual: 0 });
    expect(parseCell('3+1')).toEqual({ ok: true, regular: 3, individual: 1 });
    expect(parseCell(' 2,5 + 0,5 ')).toEqual({ ok: true, regular: 2.5, individual: 0.5 });
    expect(parseCell('')).toEqual({ ok: true, regular: 0, individual: 0 });
  });

  it('rejects garbage', () => {
    expect(parseCell('abc').ok).toBe(false);
    expect(parseCell('1+2+3').ok).toBe(false);
    expect(parseCell('-2').ok).toBe(false);
    expect(parseCell('99').ok).toBe(false);
  });

  it('formats cells back', () => {
    expect(formatCell(3, 1)).toBe('3+1');
    expect(formatCell(2.5, 0)).toBe('2,5');
    expect(formatCell(0, 0)).toBe('');
  });
});

describe('rounding', () => {
  it('rounds half up by default', () => {
    expect(roundHours(15.93, 'nearest')).toBe(16);
    expect(roundHours(2.5, 'nearest')).toBe(3);
    expect(roundHours(2.49, 'nearest')).toBe(2);
    expect(roundHours(2.1, 'up')).toBe(3);
    expect(roundHours(2.9, 'down')).toBe(2);
  });
});

describe('variant 1 — worked example from the director', () => {
  it('21.83 weighted hours, pensum 18 → 3.83 h/week → 15.93 → 16 h/month', () => {
    const core = variant1Core('21.83', 18, '4.16');
    expect(core.weeklyOvertime).toBe(3.83);
    expect(core.monthlyRaw).toBeCloseTo(15.9328, 10);
    expect(roundHours(core.monthlyRaw, 'nearest')).toBe(16);
  });

  it('3 days absent in September (22 working days) → 16 − 2 = 14 h', () => {
    const ded = variant1Deduction(16, 22, 3, 'nearest');
    expect(ded.perDay).toBeCloseTo(0.7273, 4);
    expect(ded.deductionRaw).toBeCloseTo(2.1818, 4);
    expect(ded.deduction).toBe(2);
    expect(16 - ded.deduction).toBe(14);
  });

  it('weights classes 1-2 as 1, 3-4 as 0.9 and 5 as 0.8', () => {
    const w = weightedHours(
      { k12: 10, k34: 10, k5: 5, individual: 0 },
      DEFAULT_SETTINGS.weights,
      false,
    );
    expect(w.toNumber()).toBe(23); // 10 + 9 + 4
  });

  it('is exact with decimal weights (no binary float noise)', () => {
    const w = weightedHours(
      { k12: 0, k34: 7, k5: 3, individual: 0 },
      { k12: 1, k34: 0.9, k5: 0.8, individual: 1 },
      false,
    );
    expect(w.toString()).toBe('8.7');
  });

  it('end-to-end: 10 + 10 + 5 hours, pensum 18', () => {
    const p = plan({
      timetable: { ...emptyTimetable(), k12: flat(2), k34: flat(2), k5: flat(1) },
    });
    const res = run(p);
    expect(res.v1.weightedHours).toBe(23);
    expect(res.v1.weeklyOvertime).toBe(5);
    expect(res.v1.monthlyRaw).toBe(20.8);
    expect(res.v1.monthlyRounded).toBe(21);
    // 10 monthly lines, September has 22 working days
    expect(res.v1.months).toHaveLength(10);
    expect(res.v1.months[0]!.workdays).toBe(22);
    expect(res.v1.total).toBe(210);
  });

  it('never pays negative overtime and reports the shortfall', () => {
    const p = plan({ timetable: { ...emptyTimetable(), k12: flat(3) } }); // 15 h < 18
    const res = run(p);
    expect(res.v1.weeklyOvertime).toBe(0);
    expect(res.v1.weeklyShortfall).toBe(3);
    expect(res.v1.total).toBe(0);
  });

  it('uses the contract hours of a part-time teacher as the threshold', () => {
    const p = plan({
      contractHours: 9,
      timetable: { ...emptyTimetable(), k12: flat(2) }, // 10 h
    });
    expect(effectivePensum(p)).toBe(9);
    const res = run(p);
    expect(res.v1.weeklyOvertime).toBe(1);
    expect(res.v1.monthlyRounded).toBe(4); // 1 × 4.16
  });

  it('counts individual teaching into the pensum only when it is part of the contract', () => {
    const base = plan({
      contractHours: 9,
      timetable: { ...emptyTimetable(), k12: flat(1), ind: [2, 0, 0, 0, 0] }, // 5 + 2
    });
    expect(run(base).v1.weightedHours).toBe(5);
    expect(run({ ...base, individualInPensum: true }).v1.weightedHours).toBe(7);
  });

  it('deducts absence days taken from events (whole day trips on lesson days)', () => {
    const trip = { ...createEvent('t1', 'trip', '2026-09-08'), to: '2026-09-10' }; // Tue–Thu
    const p = plan({
      timetable: { ...emptyTimetable(), k12: flat(2), k34: flat(2), k5: flat(1) },
      events: [trip],
    });
    const sep = run(p).v1.months[0]!;
    expect(sep.absenceDaysAuto).toBe(3);
    expect(sep.deduction).toBe(3); // 21 / 22 × 3 = 2.86 → 3
    expect(sep.overtime).toBe(18);
  });

  it('ignores absence on days without lessons when counting lesson days', () => {
    const e = { ...createEvent('a', 'absence', '2026-09-08'), to: '2026-09-09' };
    const p = plan({
      timetable: { ...emptyTimetable(), k12: [2, 0, 2, 2, 2], k34: flat(2), k5: flat(1) },
      events: [e], // Tue + Wed; teacher has k12 on Wed only, but k34/k5 every day
    });
    expect(run(p).v1.months[0]!.absenceDaysAuto).toBe(2);
    const free = plan({
      timetable: { ...emptyTimetable(), k12: [0, 0, 0, 0, 5] },
      events: [e],
    });
    expect(run(free).v1.months[0]!.absenceDaysAuto).toBe(0);
  });

  it('lets a manual absence count win over the automatic one', () => {
    const p = plan({
      timetable: { ...emptyTimetable(), k12: flat(2), k34: flat(2), k5: flat(1) },
      monthly: { '2026-09': { absenceDays: 3 } },
    });
    const sep = run(p).v1.months[0]!;
    expect(sep.absenceDays).toBe(3);
    expect(sep.deduction).toBe(3);
  });
});

describe('variant 2 — averaged pensum', () => {
  it('solves the threshold exactly', () => {
    const weeks = [
      ...Array.from({ length: 28 }, () => ({ hours: 25, weight: 1 })),
      ...Array.from({ length: 10 }, () => ({ hours: 12, weight: 1 })),
    ];
    const { value, annualSurplus } = solveAveragedPensum(weeks, 18);
    expect(annualSurplus).toBe(136); // 820 − 18 × 38
    expect(value).toBeCloseTo(25 - 136 / 28, 10);
    const over = weeks.reduce((acc, w) => acc + Math.max(0, w.hours - value! * w.weight), 0);
    expect(over).toBeCloseTo(136, 9);
  });

  it('handles weeks of different weight and keeps the annual balance', () => {
    const weeks = [
      { hours: 25, weight: 1 },
      { hours: 20, weight: 0.8 },
      { hours: 22, weight: 1 },
      { hours: 6, weight: 1 },
    ];
    const { value, annualSurplus } = solveAveragedPensum(weeks, 18);
    const over = weeks.reduce((acc, w) => acc + Math.max(0, w.hours - value! * w.weight), 0);
    expect(over).toBeCloseTo(annualSurplus, 9);
    expect(value!).toBeGreaterThanOrEqual(18);
  });

  it('returns no threshold when the year has no surplus', () => {
    expect(solveAveragedPensum([{ hours: 10, weight: 1 }], 18)).toEqual({
      value: null,
      annualSurplus: 0,
    });
  });

  it('a steady 25 h teacher gets exactly 7 h per teaching week', () => {
    const p = plan({ variant: 2, timetable: { ...emptyTimetable(), k12: flat(5) } });
    const res = run(p);
    expect(res.v2.averagedPensum).toBe(18);
    expect(res.v2.averagedPensumSource).toBe('auto');
    // weeks counted = teaching days / 5
    const teachingDays = calendar.months.reduce((a, m) => a + m.teachingDays, 0);
    const examDays = Object.values(calendar.days).filter((d) => d.kind === 'exam').length;
    const countedWeeks = (teachingDays - 0) / 5; // exam days are excluded (neutral policy)
    expect(res.v2.weeks).toBeCloseTo(countedWeeks, 2);
    const raw = res.v2.months.reduce((a, m) => a + m.overtimeRaw, 0);
    expect(raw).toBeCloseTo(7 * countedWeeks, 1);
    expect(examDays).toBe(8);
  });

  it('class 5 ending on 30 April pushes the averaged pensum above 18', () => {
    const p = plan({
      variant: 2,
      timetable: { ...emptyTimetable(), k12: flat(1), k5: flat(4) }, // 5 + 20 = 25 h
    });
    const res = run(p);
    expect(res.v2.averagedPensum!).toBeGreaterThan(18);
    // After April only 5 h/week remain → no overtime in May and June
    const may = res.v2.months.find((m) => m.monthKey === '2027-05')!;
    const june = res.v2.months.find((m) => m.monthKey === '2027-06')!;
    expect(may.overtime).toBe(0);
    expect(june.overtime).toBe(0);
    // The annual overtime is exactly the real surplus: Σ hours − pensum × weeks
    const raw = res.v2.months.reduce((a, m) => a + m.overtimeRaw, 0);
    expect(raw).toBeCloseTo(res.v2.annualSurplus, 1);
    expect(res.v2.annualSurplus).toBeCloseTo(res.v2.annualHours - res.v2.annualObligation, 1);
  });

  it('removes class-5 hours from the day cells after the end date', () => {
    const p = plan({ variant: 2, timetable: { ...emptyTimetable(), k5: flat(3) } });
    const res = run(p);
    expect(res.days['2027-04-30']!.regular).toBe(3);
    expect(res.days['2027-05-04']!.regular).toBe(0);
    expect(res.days['2027-05-17']!.droppedGroups).toEqual(['k5']);
  });

  it('practical training removes class 3-4 hours for its duration', () => {
    const practice = { ...createEvent('p1', 'practice', '2026-11-02'), to: '2026-11-13' };
    const p = plan({
      variant: 2,
      timetable: { ...emptyTimetable(), k12: flat(1), k34: flat(4) },
      events: [practice],
    });
    const res = run(p);
    expect(res.days['2026-11-03']!.regular).toBe(1);
    expect(res.days['2026-11-16']!.regular).toBe(5);
    // practice is not an absence of the teacher
    expect(res.days['2026-11-03']!.absence).toBe(0);
  });

  it('a whole-day trip zeroes the day and keeps the pensum obligation', () => {
    const trip = createEvent('t1', 'trip', '2026-09-09'); // Wednesday
    const base = plan({ variant: 2, timetable: { ...emptyTimetable(), k12: flat(5) } });
    const withTrip = { ...base, events: [trip] };
    const a = run(base);
    const b = run(withTrip);
    expect(b.days['2026-09-09']!.regular).toBe(0);
    expect(b.v2.annualHours).toBe(a.v2.annualHours - 5);
    expect(b.v2.weeks).toBe(a.v2.weeks);
    expect(b.v2.months[0]!.overtimeRaw).toBeLessThan(a.v2.months[0]!.overtimeRaw);
  });

  it('a partial absence only removes the missed lessons', () => {
    const ev = {
      ...createEvent('s1', 'training', '2026-09-09'),
      lessons: 'partial' as const,
      hoursPerDay: 2,
    };
    const p = plan({
      variant: 2,
      timetable: { ...emptyTimetable(), k12: flat(5) },
      events: [ev],
    });
    expect(run(p).days['2026-09-09']!.regular).toBe(3);
  });

  it('exam days are neutral: no hours, no obligation', () => {
    const p = plan({ variant: 2, timetable: { ...emptyTimetable(), k12: flat(5) } });
    const neutral = run(p);
    const normal = run(p, { ...DEFAULT_SETTINGS, examDays: 'normal' });
    expect(neutral.days['2027-05-05']!.counted).toBe(false);
    expect(neutral.days['2027-05-05']!.examExcluded).toBe(true);
    expect(normal.days['2027-05-05']!.counted).toBe(true);
    expect(normal.v2.weeks).toBeGreaterThan(neutral.v2.weeks);
  });

  it('manual cell overrides replace the timetable and understand "3+1"', () => {
    const p = plan({
      variant: 2,
      timetable: { ...emptyTimetable(), k12: flat(5) },
      cellOverrides: { '2026-09-02': '3+1', '2026-09-03': '0' },
    });
    const res = run(p);
    expect(res.days['2026-09-02']).toMatchObject({ regular: 3, individual: 1, overridden: true });
    expect(res.days['2026-09-03']).toMatchObject({ regular: 0, overridden: true });
  });

  it('individual hours are settled separately unless part of the contract', () => {
    const p = plan({
      variant: 2,
      timetable: { ...emptyTimetable(), k12: flat(3), ind: [1, 0, 0, 0, 0] },
    });
    const sept = run(p).months[0]!;
    // Mondays in September 2026: 7, 14, 21, 28 → 4 hours
    expect(sept.extras.individual).toBe(4);
    const inPensum = run({ ...p, individualInPensum: true }).months[0]!;
    expect(inPensum.extras.individual).toBe(0);
  });

  it('accepts a manually entered averaged pensum', () => {
    const p = plan({
      variant: 2,
      timetable: { ...emptyTimetable(), k12: flat(5) },
      avgPensumOverride: 21,
    });
    const res = run(p);
    expect(res.v2.averagedPensumSource).toBe('manual');
    expect(res.v2.averagedPensum).toBe(21);
    const sept = res.v2.months[0]!;
    // 22 weekdays in September → all teaching: 25 − 21 = 4 h per week
    expect(sept.overtimeRaw).toBeCloseTo(4 * (22 / 5), 1);
  });
});

describe('separately settled hours', () => {
  it('adds substitutions, trips and exams to the month of the event', () => {
    const sub = { ...createEvent('s', 'substitution', '2026-10-06'), paidHours: 3 };
    const trip = { ...createEvent('t', 'trip', '2026-10-20'), paidHours: 8 };
    const exam = { ...createEvent('e', 'exam-oral', '2027-05-12'), paidHours: 5 };
    const window = {
      ...createEvent('w', 'substitution', '2026-10-07'),
      paidHours: 2,
      settlement: 'free' as const,
    };
    const res = run(plan({ events: [sub, trip, exam, window] }));
    const oct = res.months.find((m) => m.monthKey === '2026-10')!;
    expect(oct.extras.substitutions).toBe(3);
    expect(oct.extras.trips).toBe(8);
    expect(oct.extras.free).toBe(2); // substitution in a free period is never paid
    expect(res.months.find((m) => m.monthKey === '2027-05')!.extras.exams).toBe(5);
    expect(res.selected.extrasTotal).toBe(16);
  });

  it('selects the totals of the chosen variant', () => {
    const p = plan({ timetable: { ...emptyTimetable(), k12: flat(2), k34: flat(2), k5: flat(1) } });
    expect(run({ ...p, variant: 1 }).selected.overtimeTotal).toBe(run(p).v1.total);
    expect(run({ ...p, variant: 2 }).selected.overtimeTotal).toBe(run(p).v2.total);
  });
});
