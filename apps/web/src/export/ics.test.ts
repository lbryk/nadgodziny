import { DEFAULT_CUSTOM_DAYS, DEFAULT_SETTINGS, buildCalendar, parseCalendarIcs } from '@nadgodziny/core';
import { describe, expect, it } from 'vitest';
import { buildCalendarIcs } from './ics';

const calendar = buildCalendar({ settings: DEFAULT_SETTINGS, customDays: DEFAULT_CUSTOM_DAYS });

describe('calendar ICS export', () => {
  const ics = buildCalendarIcs(calendar, 'Zespół Szkół nr 1');

  it('uses CRLF and a valid envelope', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('folds ferie into a single all-day event with an exclusive end date', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20270201');
    expect(ics).toContain('DTEND;VALUE=DATE:20270215');
  });

  it('can be read back by the ICS importer', () => {
    const { days } = parseCalendarIcs(ics);
    const kinds = Object.fromEntries(days.map((d) => [d.date, d.kind]));
    expect(kinds['2027-02-03']).toBe('ferie');
    expect(kinds['2026-10-14']).toBe('den');
    expect(kinds['2027-05-05']).toBe('exam');
  });
});
