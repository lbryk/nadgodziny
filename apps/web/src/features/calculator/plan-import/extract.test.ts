import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  blocksFromGrid,
  blocksFromText,
  mergeBlocks,
  tallyLessons,
  type DayBlock,
} from '@nadgodziny/core';
import { describe, expect, it } from 'vitest';
import { extractDocText, splitTableRows } from './doc';
import { extractDocxGrids } from './docx';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(path.resolve(__dirname, '../../../../../../e2e/fixtures', name)));

/** Hours per weekday in the sample plan: Pn 2+2+1, Wt 2+2, Śr 1+2, Cz 3, Pt 2 (see e2e/fixtures/generate.py). */
const WEEK = {
  0: { k12: 2, k34: 2, k5: 1, ind: 0 },
  1: { k12: 2, k34: 2, k5: 0, ind: 0 },
  2: { k12: 1, k34: 0, k5: 2, ind: 0 },
  3: { k12: 0, k34: 3, k5: 0, ind: 0 },
  4: { k12: 0, k34: 2, k5: 0, ind: 0 },
};

const tallies = (blocks: DayBlock[]) =>
  Object.fromEntries(
    blocks.map((b) => [b.weekday, tallyLessons(b.lessons.filter((l) => l.confident))]),
  );

describe('Word documents', () => {
  it('reads a weekly plan from a .docx table (days in columns)', () => {
    const { grids } = extractDocxGrids(fixture('plan-tydzien.docx'));
    expect(grids).toHaveLength(1);
    expect(tallies(mergeBlocks(grids.flatMap(blocksFromGrid)))).toEqual(WEEK);
  });

  it('reads a single day from a .docx and keeps the day from its title', () => {
    const { grids, paragraphs } = extractDocxGrids(fixture('plan-poniedzialek.docx'));
    expect(paragraphs.join(' ')).toMatch(/poniedziałek/);
    const blocks = grids.flatMap(blocksFromGrid);
    expect(blocks).toHaveLength(1);
    // five lessons that day → 2 + 2 + 1
    expect(tallyLessons(blocks[0]!.lessons.filter((l) => l.confident))).toEqual(WEEK[0]);
  });

  it('rejects a file that is not a docx', () => {
    expect(() => extractDocxGrids(new Uint8Array([1, 2, 3, 4]))).toThrow(/DOCX/);
  });

  it('reads the same weekly plan from a legacy .doc (Word 97–2003)', () => {
    const { rows, text } = extractDocText(fixture('plan-tydzien.doc'));
    expect(text).toContain('Poniedziałek');
    expect(rows.length).toBeGreaterThan(3);
    expect(tallies(mergeBlocks(blocksFromGrid(rows)))).toEqual(WEEK);
  });

  it('reads a single day from a legacy .doc', () => {
    const { rows, text } = extractDocText(fixture('plan-poniedzialek.doc'));
    const blocks = rows.length ? blocksFromGrid(rows) : blocksFromText(text);
    expect(tallyLessons(blocks.flatMap((b) => b.lessons).filter((l) => l.confident))).toEqual(
      WEEK[0],
    );
  });

  it('rejects a file that is not a Word document', () => {
    expect(() => extractDocText(new Uint8Array(64))).toThrow();
  });
});

describe('legacy .doc table rows', () => {
  it('tells empty cells from the end of a row by the column count', () => {
    // 3 columns; the middle cell of the second row is empty, every row ends with an empty mark
    const parts = ['A', 'B', 'C', '', 'D', '', 'F', '', 'G', 'H', 'I', ''];
    expect(splitTableRows(parts)).toEqual([
      ['A', 'B', 'C'],
      ['D', '', 'F'],
      ['G', 'H', 'I'],
    ]);
  });

  it('falls back to "an empty piece ends the row" for irregular tables', () => {
    expect(splitTableRows(['A', 'B', '', 'C', '', 'D', 'E', 'F', ''])).toEqual([
      ['A', 'B'],
      ['C'],
      ['D', 'E', 'F'],
    ]);
  });
});
