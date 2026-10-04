import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { PRINT_COLORS, type ReportOptions } from './options';
import type { Report, ReportCell } from './report-model';

const C = PRINT_COLORS;

function dayCell(cell: ReportCell): TableCell {
  const fill =
    cell.kind === 'off'
      ? C.off
      : cell.kind === 'void'
        ? C.void
        : cell.kind === 'exam'
          ? C.exam
          : undefined;
  const parts: Content[] = [];
  if (cell.regular)
    parts.push({ text: cell.regular, decoration: cell.excluded ? 'lineThrough' : undefined });
  if (cell.individual)
    parts.push({
      text: cell.regular ? `+${cell.individual}` : cell.individual,
      color: C.green,
      bold: true,
    });
  return {
    text: parts.length ? parts : '',
    alignment: 'center',
    ...(fill ? { fillColor: fill } : {}),
  } as TableCell;
}

function weeklyTable(report: Report): Content {
  const head1: TableCell[] = [
    { text: '', rowSpan: 2 },
    {
      text: 'Liczba godzin do zrealizowania w podziale na dni tygodnia',
      colSpan: 5,
      alignment: 'center',
      bold: true,
    },
    {},
    {},
    {},
    {},
    { text: 'Liczba godzin razem', rowSpan: 2, alignment: 'center', bold: true },
    { text: 'Pensum uśrednione', rowSpan: 2, alignment: 'center', bold: true },
    { text: 'Liczba godzin ponadwymiarowych', rowSpan: 2, alignment: 'center', bold: true },
  ].map((c) => ({ fillColor: C.head, ...c })) as TableCell[];
  const head2: TableCell[] = [
    {},
    ...report.weekdays.map((d) => ({ text: d, alignment: 'center', bold: true })),
    {},
    {},
    {},
  ].map((c) => ({ fillColor: C.head, ...c })) as TableCell[];

  const body: TableCell[][] = [head1, head2];
  const monthStarts = new Set<number>();
  for (const month of report.weeklyMonths) {
    monthStarts.add(body.length);
    month.rows.forEach((row) => {
      body.push([
        { text: row.label, noWrap: true },
        ...row.cells.map(dayCell),
        { text: row.hours, alignment: 'center' },
        { text: row.pensum, alignment: 'center' },
        {
          text: row.overtime,
          alignment: 'center',
          bold: row.overtime !== '' && row.overtime !== '0,00',
        },
      ]);
    });
    body.push([
      {
        text: `${month.label} — razem`,
        colSpan: 6,
        alignment: 'right',
        italics: true,
        fillColor: C.soft,
      },
      {},
      {},
      {},
      {},
      {},
      { text: month.hours, alignment: 'center', bold: true, fillColor: C.soft },
      { text: month.pensum, alignment: 'center', fillColor: C.soft },
      {
        text: `${month.overtimeRaw}  →  ${month.payable} godz.`,
        alignment: 'center',
        bold: true,
        fillColor: C.soft,
      },
    ]);
  }

  return {
    table: {
      headerRows: 2,
      dontBreakRows: true,
      widths: [104, 34, 34, 34, 34, 34, 54, 62, 96],
      body,
    },
    layout: {
      hLineWidth: (i: number) => (monthStarts.has(i) ? 1.6 : 0.4),
      vLineWidth: (i: number) => (i === 0 || i === 1 || i === 6 || i === 9 ? 1.2 : 0.4),
      hLineColor: () => C.line,
      vLineColor: () => C.line,
      paddingTop: () => 2.4,
      paddingBottom: () => 2.4,
      paddingLeft: () => 3,
      paddingRight: () => 3,
    },
    fontSize: 8,
  } as Content;
}

function kvTable(rows: { label: string; value: string }[]): Content {
  return {
    table: {
      widths: [190, '*'],
      body: rows.map((r) => [
        { text: r.label, color: '#555' },
        { text: r.value, bold: true },
      ]),
    },
    layout: 'lightHorizontalLines',
    fontSize: 9,
    margin: [0, 2, 0, 8],
  } as Content;
}

export function buildPdfDefinition(report: Report, opts: ReportOptions): TDocumentDefinitions {
  const content: Content[] = [
    { text: report.heading, bold: true, fontSize: 12, margin: [0, 0, 0, 2] },
    {
      text: '*Wypełnia każdy nauczyciel',
      italics: true,
      fontSize: 8,
      color: '#555',
      margin: [0, 0, 0, 6],
    },
    {
      table: {
        widths: ['*'],
        body: [
          [
            {
              text: `Imię nazwisko:  ${report.teacherName || '………………………………………'}`,
              fontSize: 10,
              margin: [2, 6, 2, 12],
            },
          ],
        ],
      },
      layout: { hLineWidth: () => 1, vLineWidth: () => 1 },
      margin: [0, 0, 0, 4],
    } as Content,
    {
      text: `${report.schoolName} · ${report.variantLabel} · ${report.generatedAt}`,
      fontSize: 8,
      color: '#555',
      margin: [0, 0, 0, 8],
    },
  ];

  if (opts.weekly) content.push(weeklyTable(report));

  const summary: Content[] = [
    {
      text: `Podsumowanie rozliczenia — ${report.variantLabel}`,
      bold: true,
      fontSize: 12,
      margin: [0, 0, 0, 6],
    },
    kvTable(report.facts),
  ];
  if (opts.steps && report.variant === 1) {
    summary.push(
      { text: 'Obliczenia (wariant 1)', bold: true, fontSize: 10, margin: [0, 4, 0, 3] },
      {
        table: {
          widths: [150, '*', 90],
          body: report.v1Steps.map((s) => [
            { text: s.label },
            { text: s.math, font: 'Roboto', color: '#555' },
            { text: s.result, bold: true, alignment: 'right' },
          ]),
        },
        layout: 'lightHorizontalLines',
        fontSize: 9,
        margin: [0, 0, 0, 10],
      } as Content,
    );
  }
  if (opts.monthly) {
    summary.push(
      {
        text: 'Rozliczenie miesięczne (księgowość rozlicza pełne miesiące)',
        bold: true,
        fontSize: 10,
        margin: [0, 4, 0, 3],
      },
      {
        table: {
          headerRows: 1,
          widths: [96, '*', '*', '*', '*', '*', '*', 44],
          body: [
            report.monthlyHeader.map(
              (h, i) =>
                ({
                  text: h,
                  bold: true,
                  fillColor: C.head,
                  alignment: i === 0 ? 'left' : 'center',
                }) as TableCell,
            ),
            ...report.monthlyLines.map(
              (l) =>
                [
                  { text: l.label },
                  ...l.cells.map(
                    (c, i) =>
                      ({
                        text: c,
                        alignment: 'center',
                        bold: i === l.cells.length - 1,
                      }) as TableCell,
                  ),
                ] as TableCell[],
            ),
            [
              { text: 'Razem', bold: true, fillColor: C.soft },
              ...report.monthlyTotal.map(
                (c) =>
                  ({ text: c, bold: true, alignment: 'center', fillColor: C.soft }) as TableCell,
              ),
            ] as TableCell[],
          ],
        },
        layout: 'lightHorizontalLines',
        fontSize: 8.5,
        margin: [0, 0, 0, 10],
      } as Content,
    );
  }
  if (opts.events && report.events.length) {
    summary.push(
      {
        text: 'Wydarzenia wpływające na rozliczenie',
        bold: true,
        fontSize: 10,
        margin: [0, 4, 0, 3],
      },
      {
        table: {
          headerRows: 1,
          widths: [150, 90, '*', 110],
          body: [
            ['Wydarzenie', 'Termin', 'Wpływ na zajęcia', 'Rozliczenie'].map(
              (h) => ({ text: h, bold: true, fillColor: C.head }) as TableCell,
            ),
            ...report.events.map(
              (e) =>
                [
                  { text: e.title },
                  { text: e.range, noWrap: true },
                  { text: e.effect },
                  { text: e.settlement },
                ] as TableCell[],
            ),
          ],
        },
        layout: 'lightHorizontalLines',
        fontSize: 8.5,
        margin: [0, 0, 0, 10],
      } as Content,
    );
  }
  if (opts.steps) {
    summary.push({ text: 'Informacje dodatkowe', bold: true, fontSize: 10, margin: [0, 4, 0, 3] }, {
      ul: report.notes,
      fontSize: 8,
      color: '#333',
    } as Content);
  }

  // The summary starts on a new page only when the weekly table is on the document.
  if (opts.weekly) content.push({ text: '', pageBreak: 'after' });
  content.push(...summary);

  return {
    pageSize: 'A4',
    pageMargins: [28, 28, 28, 36],
    info: {
      title: report.title,
      author: report.teacherName || 'Nauczyciel',
      subject: 'Rozliczenie nadgodzin',
    },
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    content,
    footer: (current: number, total: number) => ({
      columns: [
        {
          text: `${report.teacherName || 'Nauczyciel'} · rok szkolny ${report.schoolYear}`,
          fontSize: 7,
          color: '#777',
          margin: [28, 0, 0, 0],
        },
        {
          text: `Strona ${current} / ${total}`,
          alignment: 'right',
          fontSize: 7,
          color: '#777',
          margin: [0, 0, 28, 0],
        },
      ],
    }),
  };
}

type PdfMakeModule = {
  addVirtualFileSystem: (vfs: unknown) => void;
  createPdf: (doc: TDocumentDefinitions) => {
    download: (name: string) => Promise<void>;
    getBlob: () => Promise<Blob>;
  };
};

async function loadPdfMake(): Promise<PdfMakeModule> {
  const [pdfMakeMod, vfsMod] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const pdfMake = ((pdfMakeMod as { default?: PdfMakeModule }).default ??
    pdfMakeMod) as PdfMakeModule;
  const vfs = (vfsMod as { default?: unknown }).default ?? vfsMod;
  pdfMake.addVirtualFileSystem(vfs);
  return pdfMake;
}

export async function exportPdf(report: Report, opts: ReportOptions): Promise<void> {
  const pdfMake = await loadPdfMake();
  await pdfMake.createPdf(buildPdfDefinition(report, opts)).download(`${report.fileBaseName}.pdf`);
}
