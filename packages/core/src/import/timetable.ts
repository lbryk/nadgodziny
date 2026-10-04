import { isValidISO, weekdayOf } from '../dates';
import type { GroupId, Timetable } from '../types';

/**
 * Reading a lesson timetable (plan lekcji) — from OCR of a photo / screenshot of the e-register,
 * from the text layer of a PDF or from a Word table — and turning it into hours per weekday.
 *
 * Everything here is pure: the extractors in the web app only have to deliver either positioned
 * words (OCR, PDF) or a grid of cell texts (Word). The result is always a proposal that the
 * teacher reviews before it touches the timetable.
 */

export type LessonGroup = GroupId | 'ind';

export interface PositionedWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface DetectedLesson {
  /** Text the lesson was read from — shown next to the checkbox so it can be verified. */
  line: string;
  time?: string;
  classLabel?: string;
  level?: number;
  /** `null` = the class could not be classified, the teacher has to choose. */
  group: LessonGroup | null;
  hours: number;
  /** Lines without a class are only suggestions and start unchecked. */
  confident: boolean;
}

export interface DayBlock {
  /** 0 = Monday … 4 = Friday, `null` when the source does not say which day it shows. */
  weekday: number | null;
  lessons: DetectedLesson[];
}

/* ---------------------------------------------------------------------------------------------
 * Text helpers
 * ------------------------------------------------------------------------------------------- */

export function fold(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
}

const WEEKDAY_WORDS: [RegExp, number][] = [
  [/^(poniedzialek|poniedzialku|poniedz|pon|pn)\.?$/, 0],
  [/^(wtorek|wtorku|wt)\.?$/, 1],
  [/^(sroda|srode|srody|sr)\.?$/, 2],
  [/^(czwartek|czwartku|czw)\.?$/, 3],
  [/^(piatek|piatku|piat|pt)\.?$/, 4],
];

export function weekdayOfWord(word: string): number | null {
  const w = fold(word.trim().replace(/[,:;]+$/, ''));
  for (const [re, day] of WEEKDAY_WORDS) if (re.test(w)) return day;
  return null;
}

/** A weekday named in free text ("Plan: poniedziałek", "05.10.2026") — only when it is unambiguous. */
export function detectWeekdayInText(text: string): number | null {
  const found = new Set<number>();
  for (const token of text.split(/[\s,;()/]+/)) {
    const day = weekdayOfWord(token);
    if (day !== null) found.add(day);
  }
  for (const m of text.matchAll(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/g)) {
    const iso = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
    if (isValidISO(iso)) {
      const d = weekdayOf(iso) - 1;
      if (d <= 4) found.add(d);
    }
  }
  return found.size === 1 ? [...found][0]! : null;
}

const TIME_RE = /(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/;
// Not part of a longer word/number and not a room ("s. 3B", "sala 12").
const CLASS_RE =
  /(?<![\p{L}\p{N}])(?<!\b(?:s|sala|sal|pok|pokoj)\.?\s*)([1-8])(?:\s?(\p{Lu}[\p{L}\p{N}]{0,3})|(\p{Ll}))(?![\p{L}\p{N}])/u;
const CLASS_WORD_RE = /\bkl(?:asa|\.)?\s*([1-8])(?![\p{L}\p{N}])/iu;
const INDIVIDUAL_RE = /indywid|\bn\.?\s?ind\b|\bind\./i;

export function groupOfLevel(level: number): GroupId | null {
  if (level === 1 || level === 2) return 'k12';
  if (level === 3 || level === 4) return 'k34';
  if (level === 5) return 'k5';
  return null;
}

export function findClass(line: string): { label: string; level: number } | null {
  const m = CLASS_RE.exec(line);
  if (m) {
    const level = Number(m[1]);
    return { label: `${m[1]}${m[2] ?? m[3] ?? ''}`, level };
  }
  const w = CLASS_WORD_RE.exec(line);
  if (w) return { label: `kl. ${w[1]}`, level: Number(w[1]) };
  return null;
}

/* ---------------------------------------------------------------------------------------------
 * Lines → lessons
 * ------------------------------------------------------------------------------------------- */

function cleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

export function linesToLessons(rawLines: string[]): DetectedLesson[] {
  const lessons: DetectedLesson[] = [];
  for (const raw of rawLines) {
    const line = cleanLine(raw);
    if (line.length < 2) continue;
    const timeMatch = TIME_RE.exec(line);
    const time = timeMatch
      ? `${timeMatch[1]!.padStart(2, '0')}:${timeMatch[2]}–${timeMatch[3]!.padStart(2, '0')}:${timeMatch[4]}`
      : undefined;
    const klass = findClass(line);
    const individual = INDIVIDUAL_RE.test(line);

    if (individual) {
      lessons.push({
        line,
        time,
        classLabel: klass?.label,
        level: klass?.level,
        group: 'ind',
        hours: 1,
        confident: true,
      });
    } else if (klass) {
      lessons.push({
        line,
        time,
        classLabel: klass.label,
        level: klass.level,
        group: groupOfLevel(klass.level),
        hours: 1,
        confident: groupOfLevel(klass.level) !== null,
      });
    } else if (time && /\p{L}{3,}/u.test(line.replace(TIME_RE, ''))) {
      // a lesson row without a recognisable class — a suggestion only
      lessons.push({ line, time, group: null, hours: 1, confident: false });
    }
  }
  return lessons;
}

/* ---------------------------------------------------------------------------------------------
 * Positioned words (OCR, PDF text layer) → day blocks
 * ------------------------------------------------------------------------------------------- */

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

export function wordsToLines(words: PositionedWord[]): string[] {
  const clean = words.filter((w) => w.text.trim() !== '');
  if (clean.length === 0) return [];
  const height = median(clean.map((w) => w.y1 - w.y0)) || 10;
  const sorted = [...clean].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
  const lines: { y: number; words: PositionedWord[] }[] = [];
  for (const w of sorted) {
    const yc = (w.y0 + w.y1) / 2;
    const line = lines[lines.length - 1];
    if (line && Math.abs(yc - line.y) <= height * 0.6) {
      line.words.push(w);
      line.y = (line.y * (line.words.length - 1) + yc) / line.words.length;
    } else {
      lines.push({ y: yc, words: [w] });
    }
  }
  return lines.map((l) =>
    l.words
      .sort((a, b) => a.x0 - b.x0)
      .map((w) => w.text)
      .join(' '),
  );
}

export function blocksFromWords(words: PositionedWord[]): DayBlock[] {
  const clean = words.filter((w) => w.text.trim() !== '');
  if (clean.length === 0) return [];
  const height = median(clean.map((w) => w.y1 - w.y0)) || 10;

  const candidates = clean
    .map((w) => ({ w, day: weekdayOfWord(w.text) }))
    .filter((c): c is { w: PositionedWord; day: number } => c.day !== null)
    .sort((a, b) => a.w.y0 - b.w.y0);

  if (candidates.length >= 2) {
    const firstY = (candidates[0]!.w.y0 + candidates[0]!.w.y1) / 2;
    const header = candidates.filter(
      (c) => Math.abs((c.w.y0 + c.w.y1) / 2 - firstY) <= height * 1.2,
    );
    const days = new Set(header.map((h) => h.day));
    if (days.size >= 2) {
      const columns = [...days]
        .map((day) => {
          const cell = header.filter((h) => h.day === day);
          const xc = cell.reduce((a, h) => a + (h.w.x0 + h.w.x1) / 2, 0) / cell.length;
          return { day, xc };
        })
        .sort((a, b) => a.xc - b.xc);
      const gaps = columns.slice(1).map((c, i) => c.xc - columns[i]!.xc);
      const half = (median(gaps) || 100) / 2;
      const headerBottom = Math.max(...header.map((h) => h.w.y1));
      const body = clean.filter((w) => (w.y0 + w.y1) / 2 > headerBottom);
      return columns.map((col) => {
        const inColumn = body.filter((w) => {
          const xc = (w.x0 + w.x1) / 2;
          return xc >= col.xc - half && xc < col.xc + half;
        });
        return { weekday: col.day, lessons: linesToLessons(wordsToLines(inColumn)) };
      });
    }
  }

  const lines = wordsToLines(clean);
  return [
    {
      weekday:
        detectWeekdayInText(lines.slice(0, 4).join(' ')) ?? detectWeekdayInText(lines.join(' ')),
      lessons: linesToLessons(lines),
    },
  ];
}

/* ---------------------------------------------------------------------------------------------
 * Table grids (Word) → day blocks
 * ------------------------------------------------------------------------------------------- */

const VERTICAL_TAB = String.fromCharCode(11); // Word's soft line break
const splitCell = (text: string) =>
  text.replaceAll(VERTICAL_TAB, '\n').split(/\r?\n/).map(cleanLine).filter(Boolean);

export function blocksFromGrid(rows: string[][]): DayBlock[] {
  const grid = rows.map((r) => r.map((c) => c ?? ''));
  if (grid.length === 0) return [];

  // days in columns: a row with at least two weekday names
  const headerIndex = grid.findIndex(
    (r) => r.filter((c) => weekdayOfWord(cleanLine(c)) !== null).length >= 2,
  );
  if (headerIndex >= 0) {
    const header = grid[headerIndex]!;
    const blocks: DayBlock[] = [];
    header.forEach((cell, col) => {
      const day = weekdayOfWord(cleanLine(cell));
      if (day === null) return;
      const lines = grid.slice(headerIndex + 1).flatMap((r) => splitCell(r[col] ?? ''));
      blocks.push({ weekday: day, lessons: linesToLessons(lines) });
    });
    return mergeBlocks(blocks);
  }

  // days in rows: the first cell of a row is a weekday name
  const dayRows = grid.filter(
    (r) => weekdayOfWord(cleanLine(splitCell(r[0] ?? '')[0] ?? '')) !== null,
  );
  if (dayRows.length >= 2) {
    return mergeBlocks(
      dayRows.map((r) => ({
        weekday: weekdayOfWord(cleanLine(splitCell(r[0] ?? '')[0] ?? '')),
        lessons: linesToLessons(r.slice(1).flatMap(splitCell)),
      })),
    );
  }

  const lines = grid.flatMap((r) => r.flatMap(splitCell));
  return [
    {
      weekday:
        detectWeekdayInText(lines.slice(0, 4).join(' ')) ?? detectWeekdayInText(lines.join(' ')),
      lessons: linesToLessons(lines),
    },
  ];
}

export function blocksFromText(text: string): DayBlock[] {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  if (lines.length === 0) return [];
  return [
    {
      weekday:
        detectWeekdayInText(lines.slice(0, 4).join(' ')) ?? detectWeekdayInText(lines.join(' ')),
      lessons: linesToLessons(lines),
    },
  ];
}

/** Blocks for the same weekday are joined; blocks without a day stay as they are. */
export function mergeBlocks(blocks: DayBlock[]): DayBlock[] {
  const byDay = new Map<number, DayBlock>();
  const unknown: DayBlock[] = [];
  for (const b of blocks) {
    if (b.weekday === null) {
      unknown.push(b);
      continue;
    }
    const existing = byDay.get(b.weekday);
    if (existing) existing.lessons = [...existing.lessons, ...b.lessons];
    else byDay.set(b.weekday, { weekday: b.weekday, lessons: [...b.lessons] });
  }
  return [...[...byDay.values()].sort((a, b) => a.weekday! - b.weekday!), ...unknown];
}

/* ---------------------------------------------------------------------------------------------
 * Hours
 * ------------------------------------------------------------------------------------------- */

export type HoursByGroup = Record<LessonGroup, number>;

export function emptyHours(): HoursByGroup {
  return { k12: 0, k34: 0, k5: 0, ind: 0 };
}

/** Sums the selected lessons of one day by group — a photo of one day is just one block. */
export function tallyLessons(
  lessons: { group: LessonGroup | null; hours: number }[],
): HoursByGroup {
  const out = emptyHours();
  for (const l of lessons) {
    if (l.group) out[l.group] = Math.round((out[l.group] + l.hours) * 100) / 100;
  }
  return out;
}

export type ApplyMode = 'replace' | 'add';

/** Writes the hours of one weekday into the weekly timetable. */
export function applyDayHours(
  timetable: Timetable,
  weekday: number,
  hours: HoursByGroup,
  mode: ApplyMode,
): Timetable {
  const next: Timetable = {
    k12: [...timetable.k12],
    k34: [...timetable.k34],
    k5: [...timetable.k5],
    ind: [...timetable.ind],
  };
  for (const group of ['k12', 'k34', 'k5', 'ind'] as const) {
    const value = hours[group];
    next[group][weekday] =
      mode === 'add' ? Math.round(((next[group][weekday] ?? 0) + value) * 100) / 100 : value;
  }
  return next;
}
