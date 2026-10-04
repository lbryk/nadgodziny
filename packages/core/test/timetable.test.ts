import { describe, expect, it } from 'vitest';
import {
  applyDayHours,
  blocksFromGrid,
  blocksFromText,
  blocksFromWords,
  detectWeekdayInText,
  emptyTimetable,
  findClass,
  groupOfLevel,
  linesToLessons,
  mergeBlocks,
  tallyLessons,
  weekdayOfWord,
  wordsToLines,
  type PositionedWord,
} from '../src';

/** Lays words out like OCR would: one row of text at a given y, words left to right from x. */
function row(y: number, x: number, text: string, h = 14): PositionedWord[] {
  let cursor = x;
  return text.split(' ').map((t) => {
    const w = { text: t, x0: cursor, y0: y, x1: cursor + t.length * 8, y1: y + h };
    cursor = w.x1 + 6;
    return w;
  });
}

describe('class detection', () => {
  it.each([
    ['3TE', '3TE', 3],
    ['Matematyka 3 TE s.12', '3TE', 3],
    ['1a Język polski', '1a', 1],
    ['5TH', '5TH', 5],
    ['kl. 4', 'kl. 4', 4],
    ['  2TI/2TE  gr.1', '2TI', 2],
  ])('finds the class in "%s"', (line, label, level) => {
    const c = findClass(line);
    expect(c?.label.replace(/\s/g, '')).toBe(label.replace(/\s/g, ''));
    expect(c?.level).toBe(level);
  });

  it.each(['07:45-08:30', '45 min', 'sala 3A', 's. 12', 'Matematyka', '10 lipca 2026', 'pok. 5B'])(
    'does not mistake "%s" for a class',
    (line) => {
      expect(findClass(line)).toBeNull();
    },
  );

  it('maps levels to the weighting groups', () => {
    expect([1, 2, 3, 4, 5, 6].map(groupOfLevel)).toEqual(['k12', 'k12', 'k34', 'k34', 'k5', null]);
  });
});

describe('weekday detection', () => {
  it('understands names and abbreviations', () => {
    expect(
      ['Poniedziałek', 'pn', 'Wt.', 'środa', 'Śr', 'Czw', 'Piątek', 'pt'].map(weekdayOfWord),
    ).toEqual([0, 0, 1, 2, 2, 3, 4, 4]);
    expect(weekdayOfWord('Sobota')).toBeNull();
    expect(weekdayOfWord('prawda')).toBeNull();
  });

  it('reads a day from a title or a date, but not from an ambiguous text', () => {
    expect(detectWeekdayInText('Plan lekcji — Wtorek')).toBe(1);
    expect(detectWeekdayInText('07.10.2026')).toBe(2); // Wednesday
    expect(detectWeekdayInText('Poniedziałek Wtorek')).toBeNull();
    expect(detectWeekdayInText('bez dnia')).toBeNull();
  });
});

describe('lessons from lines', () => {
  const lines = [
    'Plan lekcji nauczyciela — Poniedziałek',
    '1 07:45-08:30 Matematyka 3TE s.12',
    '2 08:40-09:25 Matematyka 3TE s.12',
    '3 09:35-10:20 Matematyka 1TA s.4',
    '4 10:30-11:15 Okienko',
    '5 11:25-12:10 Informatyka 5TI s.7',
    '6 12:20-13:05 Nauczanie indywidualne 2TH',
  ];

  it('counts one hour per lesson row and groups by class level', () => {
    const lessons = linesToLessons(lines);
    expect(tallyLessons(lessons.filter((l) => l.confident))).toEqual({
      k12: 1,
      k34: 2,
      k5: 1,
      ind: 1,
    });
  });

  it('keeps a lesson without a class as an unchecked suggestion', () => {
    const lessons = linesToLessons(lines);
    const okienko = lessons.find((l) => l.line.includes('Okienko'))!;
    expect(okienko).toMatchObject({ group: null, confident: false });
  });

  it('formats the time of the lesson', () => {
    expect(linesToLessons(['1 7:45-8:30 Matematyka 3TE'])[0]!.time).toBe('07:45–08:30');
  });

  it('reads a single pasted day', () => {
    const [block] = blocksFromText(lines.join('\n'));
    expect(block!.weekday).toBe(0);
    expect(block!.lessons).toHaveLength(6);
  });
});

describe('positioned words (OCR / PDF)', () => {
  it('rebuilds lines in reading order', () => {
    const words = [
      ...row(100, 200, 'Matematyka 3TE'),
      ...row(100, 10, '1 07:45-08:30'),
      ...row(130, 10, '2 08:40-09:25'),
    ];
    expect(wordsToLines(words)).toEqual(['1 07:45-08:30 Matematyka 3TE', '2 08:40-09:25']);
  });

  it('a photo of one day is one block that sums its lessons', () => {
    const words = [
      ...row(20, 10, 'Wtorek 06.10.2026'),
      ...row(60, 10, '1 07:45-08:30 Matematyka 3TE'),
      ...row(90, 10, '2 08:40-09:25 Matematyka 3TE'),
      ...row(120, 10, '3 09:35-10:20 Fizyka 1TA'),
      ...row(150, 10, '4 10:30-11:15 Fizyka 1TA'),
      ...row(180, 10, '5 11:25-12:10 Fizyka 2TB'),
    ];
    const blocks = blocksFromWords(words);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.weekday).toBe(1);
    expect(tallyLessons(blocks[0]!.lessons)).toEqual({ k12: 3, k34: 2, k5: 0, ind: 0 });
  });

  it('splits a weekly grid into columns by the weekday headers', () => {
    const colX = { pn: 120, wt: 320, sr: 520 };
    const words = [
      ...row(10, colX.pn, 'Poniedziałek'),
      ...row(10, colX.wt, 'Wtorek'),
      ...row(10, colX.sr, 'Środa'),
      // time labels in the left column must not leak into Monday
      ...row(50, 5, '1 07:45-08:30'),
      ...row(50, colX.pn, 'Mat 3TE'),
      ...row(50, colX.wt, 'Fiz 1TA'),
      ...row(80, 5, '2 08:40-09:25'),
      ...row(80, colX.pn, 'Mat 3TE'),
      ...row(80, colX.sr, 'Inf 5TI'),
      ...row(110, colX.pn, 'Mat 4TB'),
    ];
    const blocks = blocksFromWords(words);
    const byDay = Object.fromEntries(
      blocks.map((b) => [b.weekday, tallyLessons(b.lessons.filter((l) => l.confident))]),
    );
    expect(byDay[0]).toEqual({ k12: 0, k34: 3, k5: 0, ind: 0 });
    expect(byDay[1]).toEqual({ k12: 1, k34: 0, k5: 0, ind: 0 });
    expect(byDay[2]).toEqual({ k12: 0, k34: 0, k5: 1, ind: 0 });
  });
});

describe('table grids (Word)', () => {
  it('days in columns', () => {
    const grid = [
      ['Godz.', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek'],
      ['1', 'Mat 3TE s.1', '', 'Mat 3TE', '', 'Mat 1TA'],
      ['2', 'Mat 3TE s.1', 'Fiz 1TA', '', 'Fiz 2TB\ns.4', ''],
    ];
    const blocks = blocksFromGrid(grid);
    expect(blocks.map((b) => b.weekday)).toEqual([0, 1, 2, 3, 4]);
    expect(blocks.map((b) => b.lessons.length)).toEqual([2, 1, 1, 1, 1]);
  });

  it('days in rows', () => {
    const grid = [
      ['', '1', '2', '3'],
      ['Poniedziałek', 'Mat 3TE', 'Mat 3TE', ''],
      ['Wtorek', 'Fiz 1TA', '', 'Fiz 5TB'],
    ];
    const blocks = blocksFromGrid(grid);
    expect(blocks.map((b) => [b.weekday, b.lessons.length])).toEqual([
      [0, 2],
      [1, 2],
    ]);
  });

  it('a one-day table keeps the day from its title', () => {
    const blocks = blocksFromGrid([['Plan — Środa'], ['1', 'Mat 3TE'], ['2', 'Mat 3TE']]);
    expect(blocks[0]!.weekday).toBe(2);
    expect(blocks[0]!.lessons).toHaveLength(2);
  });

  it('merges blocks of the same day', () => {
    const a = linesToLessons(['1 Mat 3TE']);
    const b = linesToLessons(['2 Mat 3TE']);
    expect(
      mergeBlocks([
        { weekday: 0, lessons: a },
        { weekday: 0, lessons: b },
        { weekday: null, lessons: a },
      ]),
    ).toHaveLength(2);
  });
});

describe('applying hours to the weekly timetable', () => {
  const hours = { k12: 2, k34: 3, k5: 0, ind: 1 };

  it('replaces the day', () => {
    const base = { ...emptyTimetable(), k12: [5, 5, 5, 5, 5] };
    const next = applyDayHours(base, 1, hours, 'replace');
    expect(next.k12).toEqual([5, 2, 5, 5, 5]);
    expect(next.k34).toEqual([0, 3, 0, 0, 0]);
    expect(next.ind).toEqual([0, 1, 0, 0, 0]);
    expect(base.k12).toEqual([5, 5, 5, 5, 5]); // input untouched
  });

  it('adds to the day (e.g. a second photo with the afternoon lessons)', () => {
    const base = { ...emptyTimetable(), k12: [1, 1, 1, 1, 1] };
    expect(applyDayHours(base, 0, hours, 'add').k12).toEqual([3, 1, 1, 1, 1]);
  });
});
