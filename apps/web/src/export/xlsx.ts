import { saveAs } from 'file-saver';
import type { Border, Borders, Cell, Fill, Worksheet } from 'exceljs';
import { PRINT_COLORS, type ReportOptions } from './options';
import type { Report, ReportCell } from './report-model';

/**
 * Excel workbook of the settlement — the numbers are real cells and the totals are real formulas
 * (with cached results), so a teacher or the accounting office can correct a value and see
 * the overtime recalculated.
 *
 * Sheets: "Podsumowanie" (facts, calculation steps, monthly settlement, events, notes) and,
 * when requested, "Tabela tygodniowa" laid out like the school's paper form.
 */

const C = PRINT_COLORS;
const argb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`;
const fill = (hex: string): Fill => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: argb(hex) },
});
const FONT = { name: 'Calibri', size: 10 };
const thin: Partial<Border> = { style: 'thin', color: { argb: 'FF222222' } };
const medium: Partial<Border> = { style: 'medium', color: { argb: 'FF222222' } };
const box = (top: Partial<Border> = thin): Partial<Borders> => ({
  top,
  left: thin,
  bottom: thin,
  right: thin,
});

const ROUND_FN = { nearest: 'ROUND', up: 'ROUNDUP', down: 'ROUNDDOWN' } as const;

function col(n: number): string {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26))
    s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

function style(
  cell: Cell,
  o: {
    bold?: boolean;
    fill?: string;
    align?: 'left' | 'center' | 'right';
    fmt?: string;
    color?: string;
    border?: Partial<Borders>;
    wrap?: boolean;
    italic?: boolean;
  } = {},
) {
  cell.font = {
    ...FONT,
    bold: o.bold,
    italic: o.italic,
    ...(o.color ? { color: { argb: argb(o.color) } } : {}),
  };
  if (o.fill) cell.fill = fill(o.fill);
  cell.alignment = { vertical: 'middle', horizontal: o.align, wrapText: o.wrap };
  if (o.fmt) cell.numFmt = o.fmt;
  if (o.border) cell.border = o.border;
}

function dayFill(c: ReportCell): string | undefined {
  return c.kind === 'off'
    ? C.off
    : c.kind === 'void'
      ? C.void
      : c.kind === 'exam'
        ? C.exam
        : undefined;
}

/* ---------------------------------------------------------------------------------------------
 * Weekly table
 * ------------------------------------------------------------------------------------------- */

function weeklySheet(ws: Worksheet, report: Report) {
  ws.properties.defaultRowHeight = 16;
  ws.columns = [
    { width: 22 },
    ...report.weekdays.map(() => ({ width: 6.5 })),
    { width: 9 },
    { width: 12 },
    { width: 14 },
    { width: 11 },
    { width: 13 },
  ];

  ws.mergeCells('A1:K1');
  ws.getCell('A1').value = report.heading;
  style(ws.getCell('A1'), { bold: true });
  ws.getCell('A1').font = { ...FONT, size: 13, bold: true };
  ws.getCell('A2').value = '*Wypełnia każdy nauczyciel';
  style(ws.getCell('A2'), { italic: true, color: '#555555' });
  ws.mergeCells('A3:K3');
  ws.getCell('A3').value = `Imię nazwisko:  ${report.teacherName || ''}`;
  style(ws.getCell('A3'), { border: box(medium), wrap: true });
  ws.getRow(3).height = 30;
  ws.mergeCells('A4:K4');
  ws.getCell('A4').value = `${report.schoolName} · ${report.variantLabel} · ${report.generatedAt}`;
  style(ws.getCell('A4'), { color: '#555555' });

  // header (two rows, as in the paper table)
  const h1 = 6;
  const h2 = 7;
  ws.mergeCells(h1, 1, h2, 1);
  ws.mergeCells(h1, 2, h1, 6);
  ws.getCell(h1, 2).value = 'Liczba godzin do zrealizowania w podziale na dni tygodnia';
  report.weekdays.forEach((d, i) => (ws.getCell(h2, 2 + i).value = d));
  const heads: [number, string][] = [
    [7, 'Liczba godzin razem'],
    [8, 'Pensum uśrednione'],
    [9, 'Liczba godzin ponadwymiarowych'],
    [10, 'W tym indywidualne'],
    [11, 'Do wypłaty (godz.)'],
  ];
  for (const [c, text] of heads) {
    ws.mergeCells(h1, c, h2, c);
    ws.getCell(h1, c).value = text;
  }
  for (let r = h1; r <= h2; r += 1) {
    for (let c = 1; c <= 11; c += 1) {
      style(ws.getCell(r, c), {
        bold: true,
        fill: C.head,
        align: 'center',
        border: box(),
        wrap: true,
      });
    }
  }
  ws.getRow(h1).height = 30;

  let r = h2 + 1;
  const subtotalRows: number[] = [];
  for (const month of report.weeklyMonths) {
    const first = r;
    month.rows.forEach((row, ri) => {
      const top = ri === 0 ? medium : thin;
      ws.getCell(r, 1).value = row.label;
      style(ws.getCell(r, 1), { border: box(top) });
      row.cells.forEach((c, i) => {
        const cell = ws.getCell(r, 2 + i);
        // exam days are unpaid and stay empty so the SUM below ignores them
        const hours =
          c.kind === 'school'
            ? c.regularValue + (report.individualInPensum ? c.individualValue : 0)
            : 0;
        if (c.kind === 'school' && (hours > 0 || c.regular !== '')) cell.value = hours;
        style(cell, {
          align: 'center',
          fill: dayFill(c),
          border: box(top),
          color: c.kind === 'school' && hours === 0 && c.individualValue > 0 ? C.green : undefined,
        });
      });
      if (!row.dead) {
        const sum = ws.getCell(r, 7);
        sum.value = { formula: `SUM(B${r}:F${r})`, result: row.values.hours };
        const pensum = ws.getCell(r, 8);
        pensum.value = row.values.pensum;
        const over = ws.getCell(r, 9);
        over.value = { formula: `MAX(0,G${r}-H${r})`, result: row.values.overtime };
        const ind = ws.getCell(r, 10);
        if (row.values.individual > 0) ind.value = row.values.individual;
        style(sum, { align: 'center', border: box(top) });
        style(pensum, { align: 'center', border: box(top), fmt: '0.00' });
        style(over, {
          align: 'center',
          border: box(top),
          fmt: '0.00',
          bold: row.values.overtime > 0,
        });
        style(ind, { align: 'center', border: box(top), color: C.green, bold: true });
        style(ws.getCell(r, 11), { border: box(top) });
      } else {
        for (let c = 7; c <= 11; c += 1) style(ws.getCell(r, c), { border: box(top) });
      }
      r += 1;
    });
    const last = r - 1;
    ws.mergeCells(r, 1, r, 6);
    ws.getCell(r, 1).value = `${month.label} — razem`;
    style(ws.getCell(r, 1), { italic: true, align: 'right', fill: C.soft, border: box() });
    const monthHours = month.rows.reduce((a, x) => a + (x.dead ? 0 : x.values.hours), 0);
    const monthPensum = month.rows.reduce((a, x) => a + (x.dead ? 0 : x.values.pensum), 0);
    const monthOver = month.rows.reduce((a, x) => a + (x.dead ? 0 : x.values.overtime), 0);
    const monthInd = month.rows.reduce((a, x) => a + x.values.individual, 0);
    const totals: [number, Cell['value'], string?][] = [
      [7, { formula: `SUM(G${first}:G${last})`, result: monthHours }],
      [8, { formula: `SUM(H${first}:H${last})`, result: monthPensum }, '0.00'],
      [9, { formula: `SUM(I${first}:I${last})`, result: monthOver }, '0.00'],
      [10, { formula: `SUM(J${first}:J${last})`, result: monthInd }],
      [11, { formula: `${ROUND_FN[report.rounding]}(I${r},0)`, result: month.payableValue }],
    ];
    for (const [c, value, fmt] of totals) {
      ws.getCell(r, c).value = value;
      style(ws.getCell(r, c), { bold: true, align: 'center', fill: C.soft, border: box(), fmt });
    }
    ws.getCell(r, 11).font = { ...FONT, bold: true, color: { argb: 'FF4F46E5' } };
    subtotalRows.push(r);
    r += 1;
  }

  // year total
  ws.mergeCells(r, 1, r, 6);
  ws.getCell(r, 1).value = 'Razem w roku szkolnym';
  const sumOf = (c: string) => `SUM(${subtotalRows.map((x) => `${c}${x}`).join(',')})`;
  ws.getCell(r, 11).value = {
    formula: sumOf('K'),
    result: report.weeklyMonths.reduce((a, m) => a + m.payableValue, 0),
  };
  ws.getCell(r, 7).value = {
    formula: sumOf('G'),
    result: report.weeklyMonths.reduce(
      (a, m) => a + m.rows.reduce((b, x) => b + (x.dead ? 0 : x.values.hours), 0),
      0,
    ),
  };
  ws.getCell(r, 10).value = {
    formula: sumOf('J'),
    result: report.weeklyMonths.reduce(
      (a, m) => a + m.rows.reduce((b, x) => b + x.values.individual, 0),
      0,
    ),
  };
  for (let c = 1; c <= 11; c += 1) {
    style(ws.getCell(r, c), {
      bold: true,
      align: c === 1 ? 'right' : 'center',
      fill: C.head,
      border: { top: medium, left: thin, right: thin, bottom: medium },
    });
  }

  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: h2 }];
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.3 },
  };
  ws.headerFooter.oddFooter = `&L${report.teacherName || 'Nauczyciel'} · rok szkolny ${report.schoolYear}&RStrona &P / &N`;
  ws.pageSetup.printTitlesRow = `${h1}:${h2}`;
}

/* ---------------------------------------------------------------------------------------------
 * Summary
 * ------------------------------------------------------------------------------------------- */

function summarySheet(ws: Worksheet, report: Report, opts: ReportOptions) {
  ws.columns = [
    { width: 36 },
    { width: 22 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
  ];
  let r = 1;
  ws.mergeCells(r, 1, r, 8);
  ws.getCell(r, 1).value = `Podsumowanie rozliczenia — ${report.variantLabel}`;
  ws.getCell(r, 1).font = { ...FONT, size: 14, bold: true };
  r += 1;
  ws.mergeCells(r, 1, r, 8);
  ws.getCell(r, 1).value =
    `${report.teacherName || 'Nauczyciel'} · ${report.schoolName} · rok szkolny ${report.schoolYear} · ${report.generatedAt}`;
  style(ws.getCell(r, 1), { color: '#555555' });
  r += 2;

  for (const f of report.facts) {
    ws.getCell(r, 1).value = f.label;
    ws.mergeCells(r, 2, r, 8);
    ws.getCell(r, 2).value = f.value;
    style(ws.getCell(r, 1), { color: '#555555', border: box() });
    style(ws.getCell(r, 2), { bold: true, border: box() });
    r += 1;
  }
  r += 1;

  if (opts.steps && report.variant === 1) {
    ws.getCell(r, 1).value = 'Obliczenia (wariant 1)';
    ws.getCell(r, 1).font = { ...FONT, size: 11, bold: true };
    r += 1;
    for (const s of report.v1Steps) {
      ws.getCell(r, 1).value = s.label;
      ws.mergeCells(r, 2, r, 6);
      ws.getCell(r, 2).value = s.math;
      ws.mergeCells(r, 7, r, 8);
      ws.getCell(r, 7).value = s.result;
      style(ws.getCell(r, 1), { border: box() });
      style(ws.getCell(r, 2), { color: '#555555', border: box() });
      style(ws.getCell(r, 7), { bold: true, align: 'right', border: box() });
      r += 1;
    }
    r += 1;
  }

  if (opts.monthly) {
    ws.getCell(r, 1).value = 'Rozliczenie miesięczne (księgowość rozlicza pełne miesiące)';
    ws.getCell(r, 1).font = { ...FONT, size: 11, bold: true };
    r += 1;
    const head = r;
    report.monthlyHeader.forEach((h, i) => {
      ws.getCell(r, 1 + i).value = h;
      style(ws.getCell(r, 1 + i), {
        bold: true,
        fill: C.head,
        align: i === 0 ? 'left' : 'center',
        border: box(),
        wrap: true,
      });
    });
    ws.getRow(r).height = 28;
    r += 1;
    const first = r;
    for (const line of report.monthlyLines) {
      ws.getCell(r, 1).value = line.label;
      style(ws.getCell(r, 1), { border: box() });
      line.values.slice(0, 6).forEach((v, i) => {
        const cell = ws.getCell(r, 2 + i);
        cell.value = v;
        style(cell, { align: 'center', border: box(), fmt: '0.##;-0.##;"—"' });
      });
      ws.getCell(r, 8).value = { formula: `SUM(B${r}:G${r})`, result: line.values[6] };
      style(ws.getCell(r, 8), { align: 'center', bold: true, border: box(), fmt: '0.##' });
      r += 1;
    }
    const last = r - 1;
    ws.getCell(r, 1).value = 'Razem';
    for (let c = 2; c <= 8; c += 1) {
      ws.getCell(r, c).value = {
        formula: `SUM(${col(c)}${first}:${col(c)}${last})`,
        result: report.monthlyTotalValues[c - 2],
      };
    }
    for (let c = 1; c <= 8; c += 1) {
      style(ws.getCell(r, c), {
        bold: true,
        fill: C.soft,
        align: c === 1 ? 'left' : 'center',
        border: box(medium),
        fmt: c > 1 ? '0.##' : undefined,
      });
    }
    ws.views = [{ state: 'normal' }];
    void head;
    r += 2;
  }

  if (opts.events && report.events.length) {
    ws.getCell(r, 1).value = 'Wydarzenia wpływające na rozliczenie';
    ws.getCell(r, 1).font = { ...FONT, size: 11, bold: true };
    r += 1;
    const heads = ['Wydarzenie', 'Termin', 'Wpływ na zajęcia', '', '', 'Rozliczenie', '', ''];
    ws.mergeCells(r, 3, r, 5);
    ws.mergeCells(r, 6, r, 8);
    ['Wydarzenie', 'Termin'].forEach((h, i) => (ws.getCell(r, 1 + i).value = h));
    ws.getCell(r, 3).value = 'Wpływ na zajęcia';
    ws.getCell(r, 6).value = 'Rozliczenie';
    for (let c = 1; c <= 8; c += 1)
      style(ws.getCell(r, c), { bold: true, fill: C.head, border: box() });
    void heads;
    r += 1;
    for (const e of report.events) {
      ws.mergeCells(r, 3, r, 5);
      ws.mergeCells(r, 6, r, 8);
      ws.getCell(r, 1).value = e.title;
      ws.getCell(r, 2).value = e.range;
      ws.getCell(r, 3).value = e.effect;
      ws.getCell(r, 6).value = e.settlement;
      for (let c = 1; c <= 8; c += 1) style(ws.getCell(r, c), { border: box(), wrap: true });
      ws.getRow(r).height = 28;
      r += 1;
    }
    r += 1;
  }

  if (opts.steps) {
    ws.getCell(r, 1).value = 'Informacje dodatkowe';
    ws.getCell(r, 1).font = { ...FONT, size: 11, bold: true };
    r += 1;
    for (const n of report.notes) {
      ws.mergeCells(r, 1, r, 8);
      ws.getCell(r, 1).value = `• ${n}`;
      style(ws.getCell(r, 1), { wrap: true, color: '#333333' });
      ws.getRow(r).height = n.length > 110 ? 30 : 16;
      r += 1;
    }
  }
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
}

export async function buildXlsx(report: Report, opts: ReportOptions): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = report.teacherName || 'Nauczyciel';
  wb.title = report.title;
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  summarySheet(
    wb.addWorksheet('Podsumowanie', { views: [{ showGridLines: false }] }),
    report,
    opts,
  );
  if (opts.weekly)
    weeklySheet(
      wb.addWorksheet('Tabela tygodniowa', { views: [{ showGridLines: false }] }),
      report,
    );

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export async function exportXlsx(report: Report, opts: ReportOptions): Promise<void> {
  saveAs(await buildXlsx(report, opts), `${report.fileBaseName}.xlsx`);
}
