import { describe, expect, it } from 'vitest';
import {
  buildCalendarXml,
  customDaysSchema,
  extractDaysFromText,
  inferKind,
  normalizeDateString,
  parseCalendarIcs,
  parseCalendarXml,
  settingsSchema,
  DEFAULT_SETTINGS,
  DEFAULT_CUSTOM_DAYS,
  teacherPlanSchema,
} from '../src';
import { plan } from './fixtures';

describe('kind inference', () => {
  it('recognises Polish keywords regardless of diacritics', () => {
    expect(inferKind('Ferie zimowe')).toBe('ferie');
    expect(inferKind('Zimowa przerwa świąteczna')).toBe('break');
    expect(inferKind('Egzamin ósmoklasisty')).toBe('exam');
    expect(inferKind('Matura – język polski')).toBe('exam');
    expect(inferKind('Dzień Edukacji Narodowej')).toBe('den');
    expect(inferKind('Boże Ciało')).toBe('holiday');
    expect(inferKind('Dzień wolny ustalony przez dyrektora')).toBe('director');
    expect(inferKind('coś zupełnie innego', 'other')).toBe('other');
  });
});

describe('XML import', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <kalendarz rok="2026/2027">
    <dzien data="14.10.2026" typ="den" nazwa="Dzień Edukacji Narodowej"/>
    <zakres od="2027-02-01" do="2027-02-14" typ="ferie" nazwa="Ferie zimowe"/>
    <dzien data="2027-05-04" typ="egzamin"/>
  </kalendarz>`;

  it('reads single days and ranges, skipping weekends', () => {
    const { days, warnings } = parseCalendarXml(xml);
    expect(warnings).toEqual([]);
    expect(days[0]).toEqual({ date: '2026-10-14', kind: 'den', label: 'Dzień Edukacji Narodowej' });
    const ferie = days.filter((d) => d.kind === 'ferie');
    expect(ferie).toHaveLength(10); // two school weeks
    expect(ferie.some((d) => d.date === '2027-02-06')).toBe(false); // Saturday
    expect(days.at(-1)).toEqual({ date: '2027-05-04', kind: 'exam' });
  });

  it('accepts English element names', () => {
    const { days } = parseCalendarXml(
      '<calendar><day date="2026-11-11" type="holiday" name="Niepodległość"/></calendar>',
    );
    expect(days).toEqual([{ date: '2026-11-11', kind: 'holiday', label: 'Niepodległość' }]);
  });

  it('warns about broken entries instead of failing', () => {
    const { days, warnings } = parseCalendarXml(
      '<kalendarz><dzien data="31.02.2027" typ="den"/><dzien data="2026-10-14" typ="den"/></kalendarz>',
    );
    expect(days).toHaveLength(1);
    expect(warnings).toHaveLength(1);
  });

  it('rejects malformed XML', () => {
    expect(() => parseCalendarXml('<kalendarz><dzien></kalendarz>')).toThrow(/XML/);
  });

  it('round-trips through the builder, folding consecutive days into ranges', () => {
    const out = buildCalendarXml(DEFAULT_CUSTOM_DAYS, '2026/2027');
    expect(out).toContain('<zakres od="2027-05-04" do="2027-05-07"');
    const back = parseCalendarXml(out).days;
    expect(back).toHaveLength(DEFAULT_CUSTOM_DAYS.length);
    expect(back.map((d) => d.date)).toEqual([...DEFAULT_CUSTOM_DAYS].map((d) => d.date).sort());
  });
});

describe('ICS import', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20270201',
    'DTEND;VALUE=DATE:20270215',
    'SUMMARY:Ferie zimowe',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20261014',
    'DTEND;VALUE=DATE:20261015',
    'SUMMARY:Dzień Edukacji Narodowej',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  it('treats DTEND as exclusive and classifies by summary', () => {
    const { days } = parseCalendarIcs(ics);
    expect(days.filter((d) => d.kind === 'ferie')).toHaveLength(10);
    expect(days.at(-1)?.date).toBe('2027-02-12');
    expect(days.find((d) => d.date === '2026-10-14')?.kind).toBe('den');
  });
});

describe('text (OCR) extraction', () => {
  const opts = { schoolYearStart: 2026 };

  it('reads full dates', () => {
    const { days } = extractDaysFromText('14.10.2026 - Dzień Edukacji Narodowej', opts);
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ date: '2026-10-14', kind: 'den' });
  });

  it('reads ranges with the year at the end and skips weekends', () => {
    const { days } = extractDaysFromText('Ferie zimowe: 01.02 – 14.02.2027', opts);
    expect(days).toHaveLength(10);
    expect(days[0]).toMatchObject({ date: '2027-02-01', kind: 'ferie' });
    expect(days.at(-1)!.date).toBe('2027-02-12');
  });

  it('reads compact ranges "1-14.02.2027"', () => {
    const { days } = extractDaysFromText('ferie 1-14.02.2027', opts);
    expect(days.map((d) => d.date)[0]).toBe('2027-02-01');
    expect(days).toHaveLength(10);
  });

  it('reads Polish month names', () => {
    const { days } = extractDaysFromText(
      ['14 października - Dzień Edukacji Narodowej', 'Wiosenna przerwa świąteczna 25 marca - 30 marca 2027', 'Ferie: 18-31 stycznia 2027'].join('\n'),
      opts,
    );
    const dates = days.map((d) => d.date);
    expect(dates).toContain('2026-10-14');
    expect(dates).toContain('2027-03-25');
    expect(dates).toContain('2027-03-30');
    expect(days.filter((d) => d.kind === 'ferie')).toHaveLength(10); // 18–29 Jan weekdays + … = 10
    expect(days.find((d) => d.date === '2027-03-25')?.kind).toBe('break');
  });

  it('places dates without a year inside the school year', () => {
    const { days } = extractDaysFromText('22.12 dzień wolny\n28.05 dzień wolny', opts);
    expect(days.map((d) => d.date)).toEqual(['2026-12-22', '2027-05-28']);
  });

  it('survives typical OCR damage', () => {
    const { days } = extractDaysFromText('l4.1O.2O26 Dzien Edukacji Narodowej', opts);
    expect(days[0]?.date).toBe('2026-10-14');
  });

  it('warns when nothing is found', () => {
    expect(extractDaysFromText('brak dat', opts).warnings[0]).toMatch(/Nie rozpoznano/);
  });
});

describe('date normalisation', () => {
  it('accepts several formats', () => {
    expect(normalizeDateString('2026-10-14')).toBe('2026-10-14');
    expect(normalizeDateString('14.10.2026')).toBe('2026-10-14');
    expect(normalizeDateString('4/1/2027')).toBe('2027-01-04');
    expect(normalizeDateString('31.02.2027')).toBeNull();
    expect(normalizeDateString(5)).toBeNull();
  });
});

describe('schemas', () => {
  it('validates the default settings and school days', () => {
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
    expect(customDaysSchema.safeParse(DEFAULT_CUSTOM_DAYS).success).toBe(true);
  });

  it('rejects out-of-range weights', () => {
    const bad = { ...DEFAULT_SETTINGS, weights: { ...DEFAULT_SETTINGS.weights, k34: 7 } };
    expect(settingsSchema.safeParse(bad).success).toBe(false);
  });

  it('validates a teacher plan backup', () => {
    expect(teacherPlanSchema.safeParse(plan()).success).toBe(true);
    expect(teacherPlanSchema.safeParse({ ...plan(), variant: 3 }).success).toBe(false);
  });
});
