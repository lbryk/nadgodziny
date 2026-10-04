import {
  DEFAULT_CUSTOM_DAYS,
  DEFAULT_SETTINGS,
  buildCalendar,
  calculate,
  createDefaultPlan,
  createEvent,
  emptyTimetable,
} from '@nadgodziny/core';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_REPORT_OPTIONS } from './options';
import { buildReport } from './report-model';
import { buildXlsx } from './xlsx';

const calendar = buildCalendar({ settings: DEFAULT_SETTINGS, customDays: DEFAULT_CUSTOM_DAYS });
const plan = {
  ...createDefaultPlan(DEFAULT_SETTINGS),
  teacherName: 'Zażółć Gęślą',
  variant: 2 as const,
  timetable: {
    ...emptyTimetable(),
    k12: [2, 2, 2, 2, 2],
    k34: [2, 2, 2, 2, 2],
    k5: [1, 1, 1, 1, 1],
    ind: [1, 0, 0, 0, 0],
  },
  events: [{ ...createEvent('e1', 'trip', '2026-10-20'), paidHours: 8 }],
};
const result = calculate(plan, DEFAULT_SETTINGS, calendar);
const report = buildReport(
  plan,
  DEFAULT_SETTINGS,
  calendar,
  result,
  new Date('2026-10-05T10:00:00'),
);

async function load(options = DEFAULT_REPORT_OPTIONS) {
  const blob = await buildXlsx(report, options);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await blob.arrayBuffer());
  return wb;
}

function findRow(ws: ExcelJS.Worksheet, text: string): ExcelJS.Row {
  let found: ExcelJS.Row | undefined;
  ws.eachRow((row) => {
    if (!found && String(row.getCell(1).value ?? '').includes(text)) found = row;
  });
  if (!found) throw new Error(`row "${text}" not found`);
  return found;
}

describe('Excel export', () => {
  it('has the summary and the weekly table sheets', async () => {
    const wb = await load();
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Podsumowanie', 'Tabela tygodniowa']);
  });

  it('leaves the weekly table out on request', async () => {
    const wb = await load({ ...DEFAULT_REPORT_OPTIONS, weekly: false });
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Podsumowanie']);
  });

  it('writes day hours as numbers and row totals as formulas', async () => {
    const ws = (await load()).getWorksheet('Tabela tygodniowa')!;
    const row = findRow(ws, '07.09 – 11.09.2026');
    expect([2, 3, 4, 5, 6].map((c) => row.getCell(c).value)).toEqual([5, 5, 5, 5, 5]);
    const total = row.getCell(7).value as ExcelJS.CellFormulaValue;
    expect(total.formula).toBe(`SUM(B${row.number}:F${row.number})`);
    expect(total.result).toBe(25);
    expect((row.getCell(9).value as ExcelJS.CellFormulaValue).formula).toBe(
      `MAX(0,G${row.number}-H${row.number})`,
    );
    // 1 individual hour on Monday goes to its own column
    expect(row.getCell(10).value).toBe(1);
  });

  it('keeps the colours of days off and exam days and leaves them empty', async () => {
    const ws = (await load()).getWorksheet('Tabela tygodniowa')!;
    const oct = findRow(ws, '12.10 – 16.10.2026');
    const dayOff = oct.getCell(4); // Wednesday 14.10
    expect(dayOff.value).toBeNull();
    expect((dayOff.fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FFCFCFCF');
    const may = findRow(ws, '03.05 – 07.05.2027');
    expect((may.getCell(3).fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FFFFE08A');
    expect(may.getCell(3).value).toBeNull();
  });

  it('month subtotals round like the app does and the year total matches', async () => {
    const ws = (await load()).getWorksheet('Tabela tygodniowa')!;
    const sept = findRow(ws, 'Wrzesień 2026 — razem');
    const payable = sept.getCell(11).value as ExcelJS.CellFormulaValue;
    expect(payable.formula).toMatch(/^ROUND\(I\d+,0\)$/);
    expect(payable.result).toBe(result.v2.months[0]!.overtime);
    const year = findRow(ws, 'Razem w roku szkolnym');
    expect((year.getCell(11).value as ExcelJS.CellFormulaValue).result).toBe(
      result.selected.overtimeTotal,
    );
  });

  it('summary: monthly settlement with totals that add up to the headline number', async () => {
    const ws = (await load()).getWorksheet('Podsumowanie')!;
    const total = findRow(ws, 'Razem');
    const first = total.getCell(2).value as ExcelJS.CellFormulaValue;
    expect(first.result).toBe(result.selected.overtimeTotal);
    const grand = total.getCell(8).value as ExcelJS.CellFormulaValue;
    expect(grand.result).toBeCloseTo(
      result.selected.overtimeTotal + result.selected.extrasTotal,
      5,
    );
  });
});
