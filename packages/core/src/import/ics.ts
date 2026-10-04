import { addDays, eachDay, isWeekend, isValidISO, type ISODate } from '../dates';
import type { CustomDay } from '../types';
import { inferKind } from './kinds';
import type { ImportResult } from './xml';

function icsDate(raw: string): ISODate | null {
  const m = /(\d{4})(\d{2})(\d{2})/.exec(raw);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  return isValidISO(iso) ? iso : null;
}

function unfold(text: string): string[] {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
}

/** Minimal iCalendar reader for all-day VEVENTs (school calendars exported from Google/Outlook). */
export function parseCalendarIcs(text: string): ImportResult {
  const warnings: string[] = [];
  const byDate = new Map<ISODate, CustomDay>();
  let current: { start?: ISODate; end?: ISODate; summary?: string } | null = null;

  for (const line of unfold(text)) {
    if (line.startsWith('BEGIN:VEVENT')) current = {};
    else if (line.startsWith('END:VEVENT') && current) {
      if (current.start) {
        const last = current.end ? addDays(current.end, -1) : current.start; // DTEND is exclusive
        const to = last < current.start ? current.start : last;
        const label = current.summary || undefined;
        const kind = inferKind(label ?? '', 'other');
        for (const date of eachDay(current.start, to)) {
          if (isWeekend(date)) continue;
          byDate.set(date, { date, kind, ...(label ? { label } : {}) });
        }
      } else {
        warnings.push('Pominięto wydarzenie bez daty rozpoczęcia.');
      }
      current = null;
    } else if (current) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const name = line.slice(0, idx).split(';')[0]!.toUpperCase();
      const value = line.slice(idx + 1);
      if (name === 'DTSTART') current.start = icsDate(value) ?? undefined;
      else if (name === 'DTEND') current.end = icsDate(value) ?? undefined;
      else if (name === 'SUMMARY') current.summary = unescapeText(value);
    }
  }

  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (days.length === 0) warnings.push('Nie znaleziono żadnych wydarzeń całodniowych w pliku ICS.');
  return { days, warnings };
}
