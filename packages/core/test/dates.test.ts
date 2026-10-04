import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysInMonth,
  easterSunday,
  eachDay,
  formatDMY,
  isValidISO,
  monthLabel,
  publicHolidays,
  weekdayOf,
} from '../src';

describe('dates', () => {
  it('computes weekdays with Monday = 1', () => {
    expect(weekdayOf('2026-09-01')).toBe(2); // Tuesday
    expect(weekdayOf('2026-10-04')).toBe(7); // Sunday
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
  });

  it('rejects impossible dates', () => {
    expect(isValidISO('2027-02-29')).toBe(false);
    expect(isValidISO('2028-02-29')).toBe(true);
    expect(isValidISO('2027-13-01')).toBe(false);
  });

  it('lists a range inclusively', () => {
    expect(eachDay('2026-09-30', '2026-10-02')).toEqual(['2026-09-30', '2026-10-01', '2026-10-02']);
  });

  it('counts days in a month', () => {
    expect(daysInMonth('2027-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
  });

  it('formats dates', () => {
    expect(formatDMY('2026-09-01')).toBe('01.09.2026');
    expect(monthLabel('2026-09')).toBe('Wrzesień 2026');
  });
});

describe('holidays', () => {
  it('finds Easter for known years', () => {
    expect(easterSunday(2025)).toBe('2025-04-20');
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
  });

  it('derives movable holidays from Easter', () => {
    const h = publicHolidays(2027);
    expect(h['2027-03-29']).toBe('Poniedziałek Wielkanocny');
    expect(h['2027-05-16']).toBe('Zielone Świątki');
    expect(h['2027-05-27']).toBe('Boże Ciało');
  });

  it('includes Christmas Eve only from 2025', () => {
    expect(publicHolidays(2024)['2024-12-24']).toBeUndefined();
    expect(publicHolidays(2026)['2026-12-24']).toBe('Wigilia Bożego Narodzenia');
  });
});
