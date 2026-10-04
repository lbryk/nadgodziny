import {
  DAY_KIND_LABEL,
  addDays,
  type Calendar,
  type CalendarDay,
  type DayKind,
} from '@nadgodziny/core';
import { saveAs } from 'file-saver';

const OFF: DayKind[] = ['holiday', 'break', 'ferie', 'den', 'director', 'exam', 'other'];

const icsDate = (iso: string) => iso.replaceAll('-', '');
const esc = (t: string) =>
  t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** All-day events for every day off, consecutive days with the same name folded into one event. */
export function buildCalendarIcs(calendar: Calendar, schoolName: string): string {
  const days = Object.values(calendar.days)
    .filter((d): d is CalendarDay => OFF.includes(d.kind))
    .sort((a, b) => a.date.localeCompare(b.date));

  const events: { from: string; to: string; label: string; kind: DayKind }[] = [];
  for (const d of days) {
    const label = d.label ?? DAY_KIND_LABEL[d.kind];
    const last = events[events.length - 1];
    if (last && last.kind === d.kind && last.label === label && addDays(last.to, 1) === d.date)
      last.to = d.date;
    else events.push({ from: d.date, to: d.date, label, kind: d.kind });
  }
  events.unshift(
    {
      from: calendar.startDate,
      to: calendar.startDate,
      label: 'Rozpoczęcie roku szkolnego',
      kind: 'other',
    },
    {
      from: calendar.endDate,
      to: calendar.endDate,
      label: 'Zakończenie roku szkolnego',
      kind: 'other',
    },
  );

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nadgodziny//Kalendarz roku szkolnego//PL',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${esc(`${schoolName} — rok szkolny ${calendar.label}`)}`,
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.from}-${e.kind}-${icsDate(e.to)}@nadgodziny`,
      `DTSTAMP:${icsDate(calendar.startDate)}T000000Z`,
      `DTSTART;VALUE=DATE:${icsDate(e.from)}`,
      `DTEND;VALUE=DATE:${icsDate(addDays(e.to, 1))}`,
      `SUMMARY:${esc(e.label)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function downloadCalendarIcs(calendar: Calendar, schoolName: string): void {
  saveAs(
    new Blob([buildCalendarIcs(calendar, schoolName)], { type: 'text/calendar;charset=utf-8' }),
    `kalendarz-${calendar.label.replace('/', '-')}.ics`,
  );
}
