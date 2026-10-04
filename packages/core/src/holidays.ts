import { addDays, makeISO, type ISODate } from './dates';

/** Gregorian Easter Sunday (Meeus/Jones/Butcher algorithm). */
export function easterSunday(year: number): ISODate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return makeISO(year, month, day);
}

/**
 * Polish statutory public holidays (dni ustawowo wolne od pracy) for a calendar year.
 * Christmas Eve became a public holiday in 2025.
 */
export function publicHolidays(year: number): Record<ISODate, string> {
  const easter = easterSunday(year);
  const out: Record<ISODate, string> = {
    [makeISO(year, 1, 1)]: 'Nowy Rok',
    [makeISO(year, 1, 6)]: 'Trzech Króli',
    [easter]: 'Niedziela Wielkanocna',
    [addDays(easter, 1)]: 'Poniedziałek Wielkanocny',
    [makeISO(year, 5, 1)]: 'Święto Pracy',
    [makeISO(year, 5, 3)]: 'Święto Konstytucji 3 Maja',
    [addDays(easter, 49)]: 'Zielone Świątki',
    [addDays(easter, 60)]: 'Boże Ciało',
    [makeISO(year, 8, 15)]: 'Wniebowzięcie NMP',
    [makeISO(year, 11, 1)]: 'Wszystkich Świętych',
    [makeISO(year, 11, 11)]: 'Narodowe Święto Niepodległości',
    [makeISO(year, 12, 25)]: 'Boże Narodzenie (1. dzień)',
    [makeISO(year, 12, 26)]: 'Boże Narodzenie (2. dzień)',
  };
  if (year >= 2025) out[makeISO(year, 12, 24)] = 'Wigilia Bożego Narodzenia';
  return out;
}
