import { useEffect } from 'react';
import { create } from 'zustand';
import { useCalc } from '../hooks/calc-context';
import { DEFAULT_REPORT_OPTIONS, PRINT_COLORS, type ReportOptions } from './options';
import { buildReport, type ReportCell } from './report-model';

interface PrintState {
  printing: boolean;
  options: ReportOptions;
}

const usePrintStore = create<PrintState>(() => ({ printing: false, options: DEFAULT_REPORT_OPTIONS }));

/** Renders the report into the DOM, opens the browser print dialog, then removes it again. */
export function printReport(options: ReportOptions = DEFAULT_REPORT_OPTIONS): void {
  usePrintStore.setState({ printing: true, options });
}

const C = PRINT_COLORS;
const cellBorder = '0.5pt solid #222';

function Day({ c }: { c: ReportCell }) {
  const fill = c.kind === 'off' ? C.off : c.kind === 'void' ? C.void : c.kind === 'exam' ? C.exam : undefined;
  return (
    <td style={{ border: cellBorder, background: fill, textAlign: 'center', height: '5.1mm', padding: 0 }}>
      {c.regular && <span style={{ textDecoration: c.excluded ? 'line-through' : undefined }}>{c.regular}</span>}
      {c.individual && <b style={{ color: C.green }}>{c.regular ? `+${c.individual}` : c.individual}</b>}
    </td>
  );
}

export function PrintHost() {
  const { plan, settings, calendar, result } = useCalc();
  const { printing, options } = usePrintStore();

  useEffect(() => {
    if (!printing) return;
    const done = () => usePrintStore.setState({ printing: false });
    window.addEventListener('afterprint', done, { once: true });
    // two frames: let React paint the report before the dialog freezes the page
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => window.print());
    });
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);

  if (!printing) return null;
  const report = buildReport(plan, settings, calendar, result);
  const th = { border: cellBorder, background: C.head, padding: '1mm', fontWeight: 600 } as const;
  const td = { border: cellBorder, padding: '0 1.2mm' } as const;

  return (
    <div className="print-root print-only" style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '8.5pt', color: '#000' }}>
      <h1 style={{ fontSize: '12pt', margin: 0 }}>{report.heading}</h1>
      <p style={{ margin: '0 0 2mm', fontStyle: 'italic', fontSize: '8pt', color: '#555' }}>*Wypełnia każdy nauczyciel</p>
      <div style={{ border: '1pt solid #000', padding: '2mm 2mm 7mm', fontSize: '10pt' }}>
        Imię nazwisko: {report.teacherName || '………………………………………'}
      </div>
      <p style={{ margin: '1.5mm 0 3mm', fontSize: '8pt', color: '#555' }}>
        {report.schoolName} · {report.variantLabel} · {report.generatedAt}
      </p>

      {options.weekly && (
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '24%' }} />
            {report.weekdays.map((d) => (
              <col key={d} style={{ width: '7.5%' }} />
            ))}
            <col style={{ width: '10%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '16.5%' }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} style={th} />
              <th colSpan={5} style={th}>
                Liczba godzin do zrealizowania w podziale na dni tygodnia
              </th>
              <th rowSpan={2} style={th}>Liczba godzin razem</th>
              <th rowSpan={2} style={th}>Pensum uśrednione</th>
              <th rowSpan={2} style={th}>Liczba godzin ponadwymiarowych</th>
            </tr>
            <tr>
              {report.weekdays.map((d) => (
                <th key={d} style={th}>{d}</th>
              ))}
            </tr>
          </thead>
          {report.weeklyMonths.map((m) => (
            <tbody key={m.key} style={{ breakInside: 'avoid' }}>
              {m.rows.map((r, ri) => (
                <tr key={r.label} style={{ breakInside: 'avoid', borderTop: ri === 0 ? '1.6pt solid #222' : undefined }}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.label}</td>
                  {r.cells.map((c, i) => (
                    <Day key={i} c={c} />
                  ))}
                  <td style={{ ...td, textAlign: 'center' }}>{r.hours}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{r.pensum}</td>
                  <td style={{ ...td, textAlign: 'center', fontWeight: 600 }}>{r.overtime}</td>
                </tr>
              ))}
              <tr style={{ background: C.soft, breakInside: 'avoid' }}>
                <td colSpan={6} style={{ ...td, textAlign: 'right', fontStyle: 'italic' }}>{m.label} — razem</td>
                <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{m.hours}</td>
                <td style={{ ...td, textAlign: 'center' }}>{m.pensum}</td>
                <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{m.overtimeRaw} → {m.payable} godz.</td>
              </tr>
            </tbody>
          ))}
        </table>
      )}

      <section style={{ breakBefore: options.weekly ? 'page' : undefined, marginTop: options.weekly ? 0 : '6mm' }}>
        <h2 style={{ fontSize: '12pt', margin: '0 0 2mm' }}>Podsumowanie rozliczenia — {report.variantLabel}</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4mm' }}>
          <tbody>
            {report.facts.map((f) => (
              <tr key={f.label}>
                <td style={{ ...td, color: '#555', width: '45%' }}>{f.label}</td>
                <td style={{ ...td, fontWeight: 600 }}>{f.value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {options.steps && report.variant === 1 && (
          <>
            <h3 style={{ fontSize: '10pt', margin: '0 0 1.5mm' }}>Obliczenia (wariant 1)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4mm' }}>
              <tbody>
                {report.v1Steps.map((s) => (
                  <tr key={s.label}>
                    <td style={td}>{s.label}</td>
                    <td style={{ ...td, color: '#555' }}>{s.math}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{s.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {options.monthly && (
          <>
            <h3 style={{ fontSize: '10pt', margin: '0 0 1.5mm' }}>Rozliczenie miesięczne (księgowość rozlicza pełne miesiące)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4mm' }}>
              <thead>
                <tr>{report.monthlyHeader.map((h, i) => <th key={h} style={{ ...th, textAlign: i === 0 ? 'left' : 'center' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {report.monthlyLines.map((l) => (
                  <tr key={l.label}>
                    <td style={td}>{l.label}</td>
                    {l.cells.map((c, i) => (
                      <td key={i} style={{ ...td, textAlign: 'center', fontWeight: i === l.cells.length - 1 ? 700 : 400 }}>{c}</td>
                    ))}
                  </tr>
                ))}
                <tr style={{ background: C.soft }}>
                  <td style={{ ...td, fontWeight: 700 }}>Razem</td>
                  {report.monthlyTotal.map((c, i) => (
                    <td key={i} style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{c}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </>
        )}

        {options.events && report.events.length > 0 && (
          <>
            <h3 style={{ fontSize: '10pt', margin: '0 0 1.5mm' }}>Wydarzenia wpływające na rozliczenie</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4mm' }}>
              <thead>
                <tr>{['Wydarzenie', 'Termin', 'Wpływ na zajęcia', 'Rozliczenie'].map((h) => <th key={h} style={{ ...th, textAlign: 'left' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {report.events.map((e, i) => (
                  <tr key={i}>
                    <td style={td}>{e.title}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{e.range}</td>
                    <td style={td}>{e.effect}</td>
                    <td style={td}>{e.settlement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {options.steps && (
          <>
            <h3 style={{ fontSize: '10pt', margin: '0 0 1.5mm' }}>Informacje dodatkowe</h3>
            <ul style={{ margin: 0, paddingLeft: '5mm', fontSize: '8pt' }}>
              {report.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
