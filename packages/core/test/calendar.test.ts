import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  schoolYearEndDate,
  schoolYearStartDate,
  easterBreak,
  buildCalendar,
  feriePreset,
} from '../src';
import { defaultCalendar } from './fixtures';

describe('school year rules', () => {
  it('starts on the first working day of September', () => {
    expect(schoolYearStartDate(2026)).toBe('2026-09-01'); // Tuesday
    expect(schoolYearStartDate(2025)).toBe('2025-09-01'); // Monday
    expect(schoolYearStartDate(2024)).toBe('2024-09-02'); // 1 Sep is Sunday
    expect(schoolYearStartDate(2029)).toBe('2029-09-03'); // 1 Sep is Saturday
    expect(schoolYearStartDate(2030)).toBe('2030-09-02'); // 1 Sep is Sunday
    expect(schoolYearStartDate(2035)).toBe('2035-09-03'); // 1 Sep is Saturday
  });

  it('ends on the first Friday after 20 June', () => {
    expect(schoolYearEndDate(2026)).toBe('2027-06-25');
    expect(schoolYearEndDate(2025)).toBe('2026-06-26');
  });

  it('puts the spring break between Thursday before and Tuesday after Easter', () => {
    expect(easterBreak(2026)).toEqual({ from: '2027-03-25', to: '2027-03-30' });
  });

  it('knows the 2027 ferie by voivodeship', () => {
    expect(feriePreset(2026, 'mazowieckie')).toEqual({ from: '2027-02-01', to: '2027-02-14' });
    expect(feriePreset(2026, 'slaskie')).toEqual({ from: '2027-01-18', to: '2027-01-31' });
    expect(feriePreset(2026, 'malopolskie')).toEqual({ from: '2027-02-15', to: '2027-02-28' });
    expect(feriePreset(2031, 'mazowieckie')).toBeNull();
  });
});

/**
 * Cells of the paper table "Tabela rozliczenia godzin zajęć dydaktycznych 2026/2027"
 * (grey = day off, yellow = exam day), read from the PDF supplied by the school.
 */
const PDF_GREY = [
  '2026-10-14', '2026-11-11',
  '2026-12-22', '2026-12-23', '2026-12-24', '2026-12-25',
  '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',
  '2027-01-01', '2027-01-06',
  '2027-02-01', '2027-02-02', '2027-02-03', '2027-02-04', '2027-02-05',
  '2027-02-08', '2027-02-09', '2027-02-10', '2027-02-11', '2027-02-12',
  '2027-03-25', '2027-03-26', '2027-03-29', '2027-03-30',
  '2027-05-03', '2027-05-27', '2027-05-28',
];
const PDF_YELLOW = [
  '2027-01-12',
  '2027-05-04', '2027-05-05', '2027-05-06', '2027-05-07',
  '2027-06-08', '2027-06-09', '2027-06-25',
];
const PDF_ROW_STARTS = [
  '2026-09-01', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-01',
  '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09',
  '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-01', '2026-12-07', '2026-12-14',
  '2026-12-21', '2026-12-28', '2027-01-01', '2027-01-04', '2027-01-11', '2027-01-18',
  '2027-01-25', '2027-02-01', '2027-02-08', '2027-02-15', '2027-02-22', '2027-03-01',
  '2027-03-08', '2027-03-15', '2027-03-22', '2027-03-29', '2027-04-01', '2027-04-05',
  '2027-04-12', '2027-04-19', '2027-04-26', '2027-05-03', '2027-05-10', '2027-05-17',
  '2027-05-24', '2027-05-31', '2027-06-01', '2027-06-07', '2027-06-14', '2027-06-21',
];

describe('calendar 2026/2027 vs. the school table (PDF)', () => {
  const calendar = defaultCalendar();

  it('has the same week rows as the paper table', () => {
    expect(calendar.rows.map((r) => r.from)).toEqual(PDF_ROW_STARTS);
  });

  it('splits weeks at month boundaries and labels them like the table', () => {
    const labels = Object.fromEntries(calendar.rows.map((r) => [r.from, r.label]));
    expect(labels['2026-09-28']).toBe('28.09 – 30.09.2026');
    expect(labels['2026-10-01']).toBe('01.10 – 02.10.2026');
    expect(labels['2026-11-30']).toBe('30.11.2026');
    expect(labels['2027-01-01']).toBe('01.01.2027');
  });

  it('marks exactly the same days off as the grey cells', () => {
    const off = Object.values(calendar.days)
      .filter((d) => d.date.slice(5) !== '' && !['weekend', 'outside'].includes(d.kind))
      .filter((d) => !['school', 'exam'].includes(d.kind))
      .map((d) => d.date)
      .filter((d) => {
        const day = new Date(`${d}T00:00:00Z`).getUTCDay();
        return day >= 1 && day <= 5;
      })
      .filter((d) => d >= '2026-09-01' && d <= '2027-06-25');
    expect(off.sort()).toEqual([...PDF_GREY].sort());
  });

  it('marks exactly the same days as exam days as the yellow cells', () => {
    const exam = Object.values(calendar.days)
      .filter((d) => d.kind === 'exam')
      .map((d) => d.date);
    expect(exam.sort()).toEqual([...PDF_YELLOW].sort());
  });

  it('has 22 working days in September 2026 (example from the director)', () => {
    expect(calendar.months[0]!.key).toBe('2026-09');
    expect(calendar.months[0]!.workdays).toBe(22);
  });

  it('counts working days per month excluding statutory holidays', () => {
    const byKey = Object.fromEntries(calendar.months.map((m) => [m.key, m.workdays]));
    expect(byKey['2026-11']).toBe(20); // 21 weekdays − 11 Nov
    expect(byKey['2026-12']).toBe(21); // 23 weekdays − 24, 25 Dec
    expect(byKey['2027-01']).toBe(19); // 21 weekdays − 1 Jan, 6 Jan
    expect(byKey['2027-05']).toBe(19); // 21 weekdays − 3 May, 27 May
  });

  it('keeps the ferie window configurable per voivodeship', () => {
    const slask = buildCalendar({
      settings: { ...DEFAULT_SETTINGS, voivodeship: 'slaskie' },
      customDays: [],
    });
    expect(slask.days['2027-01-20']?.kind).toBe('ferie');
    expect(slask.days['2027-02-03']?.kind).toBe('school');
  });

  it('lets administrator overrides win over the rules', () => {
    const cal = buildCalendar({
      settings: DEFAULT_SETTINGS,
      customDays: [{ date: '2026-10-14', kind: 'school', label: 'Dzień pracy' }],
    });
    expect(cal.days['2026-10-14']?.kind).toBe('school');
  });
});
