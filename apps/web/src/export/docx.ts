import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type ITableCellOptions,
} from 'docx';
import { saveAs } from 'file-saver';
import { PRINT_COLORS, type ReportOptions } from './options';
import type { Report, ReportCell } from './report-model';

const C = PRINT_COLORS;
const hex = (c: string) => c.replace('#', '');
const FONT = 'Calibri';

const thin = { style: BorderStyle.SINGLE, size: 4, color: '222222' };
const thick = { style: BorderStyle.SINGLE, size: 14, color: '222222' };

function para(
  text: string,
  opts: {
    bold?: boolean;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    color?: string;
    italics?: boolean;
    spacingAfter?: number;
  } = {},
) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.spacingAfter ?? 0, before: 0 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        size: opts.size ?? 16,
        font: FONT,
        color: opts.color,
        italics: opts.italics,
      }),
    ],
  });
}

function cell(
  children: Paragraph[],
  opts: { fill?: string; span?: number; width: number; top?: boolean; rowSpan?: number } = {
    width: 0,
  },
): TableCell {
  const o: ITableCellOptions = {
    children,
    width: { size: opts.width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 30, bottom: 30, left: 60, right: 60 },
    columnSpan: opts.span,
    rowSpan: opts.rowSpan,
    shading: opts.fill
      ? { type: ShadingType.CLEAR, fill: hex(opts.fill), color: 'auto' }
      : undefined,
    borders: { top: opts.top ? thick : thin, bottom: thin, left: thin, right: thin },
  };
  return new TableCell(o);
}

function dayParagraph(c: ReportCell): Paragraph {
  const runs: TextRun[] = [];
  if (c.regular)
    runs.push(new TextRun({ text: c.regular, size: 16, font: FONT, strike: c.excluded }));
  if (c.individual) {
    runs.push(
      new TextRun({
        text: c.regular ? `+${c.individual}` : c.individual,
        size: 16,
        font: FONT,
        bold: true,
        color: hex(C.green),
      }),
    );
  }
  return new Paragraph({ alignment: AlignmentType.CENTER, children: runs });
}

const W = { label: 1900, day: 560, sum: 900, pensum: 1000, over: 1400 };

function weeklyTable(report: Report): Table {
  const head = (text: string, width: number, extra: { span?: number; rowSpan?: number } = {}) =>
    cell([para(text, { bold: true, align: AlignmentType.CENTER })], {
      fill: C.head,
      width,
      ...extra,
    });
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        head('', W.label, { rowSpan: 2 }),
        head('Liczba godzin do zrealizowania w podziale na dni tygodnia', W.day * 5, { span: 5 }),
        head('Liczba godzin razem', W.sum, { rowSpan: 2 }),
        head('Pensum uśrednione', W.pensum, { rowSpan: 2 }),
        head('Liczba godzin ponadwymiarowych', W.over, { rowSpan: 2 }),
      ],
    }),
    new TableRow({ tableHeader: true, children: report.weekdays.map((d) => head(d, W.day)) }),
  ];

  for (const month of report.weeklyMonths) {
    month.rows.forEach((row, ri) => {
      const top = ri === 0;
      rows.push(
        new TableRow({
          cantSplit: true,
          children: [
            cell([para(row.label)], { width: W.label, top }),
            ...row.cells.map((c) => {
              const fill =
                c.kind === 'off'
                  ? C.off
                  : c.kind === 'void'
                    ? C.void
                    : c.kind === 'exam'
                      ? C.exam
                      : undefined;
              return cell([dayParagraph(c)], { width: W.day, fill, top });
            }),
            cell([para(row.hours, { align: AlignmentType.CENTER })], { width: W.sum, top }),
            cell([para(row.pensum, { align: AlignmentType.CENTER })], { width: W.pensum, top }),
            cell(
              [
                para(row.overtime, {
                  align: AlignmentType.CENTER,
                  bold: row.overtime !== '' && row.overtime !== '0,00',
                }),
              ],
              { width: W.over, top },
            ),
          ],
        }),
      );
    });
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          cell([para(`${month.label} — razem`, { align: AlignmentType.RIGHT, italics: true })], {
            width: W.label + W.day * 5,
            span: 6,
            fill: C.soft,
          }),
          cell([para(month.hours, { align: AlignmentType.CENTER, bold: true })], {
            width: W.sum,
            fill: C.soft,
          }),
          cell([para(month.pensum, { align: AlignmentType.CENTER })], {
            width: W.pensum,
            fill: C.soft,
          }),
          cell(
            [
              para(`${month.overtimeRaw} → ${month.payable} godz.`, {
                align: AlignmentType.CENTER,
                bold: true,
              }),
            ],
            { width: W.over, fill: C.soft },
          ),
        ],
      }),
    );
  }

  return new Table({
    width: { size: W.label + W.day * 5 + W.sum + W.pensum + W.over, type: WidthType.DXA },
    columnWidths: [W.label, ...report.weekdays.map(() => W.day), W.sum, W.pensum, W.over],
    rows,
  });
}

function simpleTable(
  header: string[] | null,
  body: string[][],
  widths: number[],
  boldLast = false,
): Table {
  const total = widths.reduce((a, b) => a + b, 0);
  const rows: TableRow[] = [];
  if (header) {
    rows.push(
      new TableRow({
        tableHeader: true,
        children: header.map((h, i) =>
          cell(
            [
              para(h, {
                bold: true,
                size: 16,
                align: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
              }),
            ],
            { fill: C.head, width: widths[i]! },
          ),
        ),
      }),
    );
  }
  body.forEach((r, ri) => {
    const last = boldLast && ri === body.length - 1;
    rows.push(
      new TableRow({
        cantSplit: true,
        children: r.map((t, i) =>
          cell(
            [
              para(t, {
                size: 16,
                bold: last || (i === r.length - 1 && header !== null && i > 0),
                align: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
              }),
            ],
            {
              width: widths[i]!,
              fill: last ? C.soft : undefined,
            },
          ),
        ),
      }),
    );
  });
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, rows });
}

export async function buildDocx(report: Report, opts: ReportOptions): Promise<Blob> {
  const spacer = (after = 160) => new Paragraph({ spacing: { after }, children: [] });
  const h = (text: string) => para(text, { bold: true, size: 22, spacingAfter: 100 });
  const children: (Paragraph | Table)[] = [
    para(report.heading, { bold: true, size: 26, spacingAfter: 40 }),
    para('*Wypełnia każdy nauczyciel', {
      italics: true,
      size: 16,
      color: '555555',
      spacingAfter: 100,
    }),
    new Table({
      width: { size: 9560, type: WidthType.DXA },
      columnWidths: [9560],
      rows: [
        new TableRow({
          height: { value: 520, rule: 'atLeast' },
          children: [
            cell(
              [para(`Imię nazwisko:  ${report.teacherName || '………………………………………'}`, { size: 20 })],
              { width: 9560 },
            ),
          ],
        }),
      ],
    }),
    para(`${report.schoolName} · ${report.variantLabel} · ${report.generatedAt}`, {
      size: 16,
      color: '555555',
      spacingAfter: 140,
    }),
  ];

  if (opts.weekly) children.push(weeklyTable(report));

  children.push(
    new Paragraph({
      pageBreakBefore: opts.weekly,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: `Podsumowanie rozliczenia — ${report.variantLabel}`,
          bold: true,
          size: 26,
          font: FONT,
        }),
      ],
    }),
  );
  children.push(
    simpleTable(
      null,
      report.facts.map((f) => [f.label, f.value]),
      [3600, 5960],
    ),
    spacer(),
  );

  if (opts.steps && report.variant === 1) {
    children.push(
      h('Obliczenia (wariant 1)'),
      simpleTable(
        null,
        report.v1Steps.map((s) => [s.label, s.math, s.result]),
        [3200, 4160, 2200],
      ),
      spacer(),
    );
  }
  if (opts.monthly) {
    children.push(
      h('Rozliczenie miesięczne (księgowość rozlicza pełne miesiące)'),
      simpleTable(
        report.monthlyHeader,
        [
          ...report.monthlyLines.map((l) => [l.label, ...l.cells]),
          ['Razem', ...report.monthlyTotal],
        ],
        [1900, 1150, 1100, 1150, 1000, 1000, 800, 1000],
        true,
      ),
      spacer(),
    );
  }
  if (opts.events && report.events.length) {
    children.push(
      h('Wydarzenia wpływające na rozliczenie'),
      simpleTable(
        ['Wydarzenie', 'Termin', 'Wpływ na zajęcia', 'Rozliczenie'],
        report.events.map((e) => [e.title, e.range, e.effect, e.settlement]),
        [2800, 1800, 2700, 2260],
      ),
      spacer(),
    );
  }
  if (opts.steps) {
    children.push(h('Informacje dodatkowe'));
    for (const n of report.notes) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 40 },
          children: [new TextRun({ text: n, size: 16, font: FONT })],
        }),
      );
    }
  }

  const doc = new Document({
    creator: report.teacherName || 'Nauczyciel',
    title: report.title,
    description: 'Rozliczenie nadgodzin',
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 700, bottom: 760, left: 760, right: 760 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${report.teacherName || 'Nauczyciel'} · rok szkolny ${report.schoolYear} · strona `,
                    size: 14,
                    color: '777777',
                    font: FONT,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 14,
                    color: '777777',
                    font: FONT,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}

export async function exportDocx(report: Report, opts: ReportOptions): Promise<void> {
  saveAs(await buildDocx(report, opts), `${report.fileBaseName}.docx`);
}
