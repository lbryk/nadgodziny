import type { CustomDay } from '../types';

export type ImportKind = CustomDay['kind'];

/** Maps free-text type names (XML attributes, calendar summaries, OCR lines) to a day kind. */
export function inferKind(text: string, fallback: ImportKind = 'other'): ImportKind {
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
  if (/egzamin|matur|osmoklas|zawodow/.test(t)) return 'exam';
  if (/ferie/.test(t)) return 'ferie';
  if (/przerwa|przerwy/.test(t)) return 'break';
  if (/edukacji narodowej|\bden\b/.test(t)) return 'den';
  if (/dyrektor|dyrektorsk/.test(t)) return 'director';
  if (
    /swiet|nowy rok|boze cialo|wielkanoc|boze narodzenie|wigilia|konstytucji|niepodleglosci|trzech kroli|wszystkich swietych/.test(
      t,
    )
  ) {
    return 'holiday';
  }
  // "dzień wolny od zajęć" must not be mistaken for a teaching day
  if (/wolny|wolne|bez zajec|odwolan/.test(t)) return 'other';
  if (/dzien pracy|dzien nauki|zajecia odbywaja|odpracow/.test(t)) return 'school';
  return fallback;
}

const TYPE_ALIASES: Record<string, ImportKind> = {
  school: 'school',
  szkola: 'school',
  zajecia: 'school',
  holiday: 'holiday',
  swieto: 'holiday',
  break: 'break',
  przerwa: 'break',
  ferie: 'ferie',
  den: 'den',
  men: 'den',
  director: 'director',
  dyrektor: 'director',
  dyrektorski: 'director',
  exam: 'exam',
  egzamin: 'exam',
  egzaminy: 'exam',
  other: 'other',
  inny: 'other',
  inne: 'other',
  wolny: 'other',
};

export function kindFromAttribute(value: unknown, fallback: ImportKind = 'other'): ImportKind {
  if (typeof value !== 'string') return fallback;
  const key = value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
  return TYPE_ALIASES[key] ?? inferKind(value, fallback);
}
