import {
  ChevronDown,
  FileDown,
  FileText,
  FolderOpen,
  Printer,
  Save,
  Scale,
  TableProperties,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Fragment, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Callout } from '../../components/ui/callout';
import { Card, CardBody, CardHeader } from '../../components/ui/card';
import { CountUp } from '../../components/ui/count-up';
import { NumberField } from '../../components/ui/field';
import { Spinner } from '../../components/ui/spinner';
import { Toggle } from '../../components/ui/switch';
import { useCalc } from '../../hooks/calc-context';
import { DEFAULT_REPORT_OPTIONS, type ReportOptions } from '../../export/options';
import { printReport } from '../../export/print-host';
import { buildReport } from '../../export/report-model';
import { downloadPlanBackup, readPlanBackup } from '../../export/backup';
import { cn } from '../../lib/cn';
import { fmt, fmt2, fmtPln, hoursWord } from '../../lib/format';
import { usePlanStore } from '../../state/plan-store';
import { V1Steps } from './v1-steps';

export default function ResultStep() {
  const { plan, settings, calendar, result } = useCalc();
  const { patch, replacePlan, setMonthly, unsetMonthly } = usePlanStore();
  const [options, setOptions] = useState<ReportOptions>({ ...DEFAULT_REPORT_OPTIONS, weekly: plan.variant === 2 });
  const [busy, setBusy] = useState<'pdf' | 'docx' | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const report = useMemo(() => buildReport(plan, settings, calendar, result), [plan, settings, calendar, result]);
  const { selected } = result;
  const other = plan.variant === 1 ? result.v2.total : result.v1.total;
  const diff = selected.overtimeTotal - other;

  const chartData = result.months.map((m) => ({
    name: m.label.split(' ')[0]!.slice(0, 3),
    full: m.label,
    'Wariant 1': m.v1.overtime,
    'Wariant 2': m.v2.overtime,
  }));

  const run = async (kind: 'pdf' | 'docx') => {
    setBusy(kind);
    try {
      if (kind === 'pdf') {
        const { exportPdf } = await import('../../export/pdf');
        await exportPdf(report, options);
      } else {
        const { exportDocx } = await import('../../export/docx');
        await exportDocx(report, options);
      }
      toast.success(kind === 'pdf' ? 'Plik PDF został pobrany.' : 'Plik DOCX został pobrany.');
    } catch (error) {
      console.error(error);
      toast.error('Nie udało się wygenerować pliku. Spróbuj ponownie.');
    } finally {
      setBusy(null);
    }
  };

  const toggle = (key: keyof ReportOptions) => (v: boolean) => setOptions((o) => ({ ...o, [key]: v }));

  return (
    <div className="space-y-6">
      <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-10 size-72 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm text-muted">
              {plan.teacherName || 'Twoje'} nadgodziny w roku {calendar.label} · {report.variantLabel}
            </p>
            <p className="mt-2 flex items-baseline gap-3">
              <CountUp value={selected.overtimeTotal} className="num text-6xl font-semibold tracking-tight" />
              <span className="text-xl text-muted">{hoursWord(selected.overtimeTotal)}</span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {selected.extrasTotal > 0 && <Badge tone="ok">+ {fmt(selected.extrasTotal)} godz. rozliczanych odrębnie</Badge>}
              {plan.hourlyRate ? <Badge tone="brand">≈ {fmtPln(selected.grandTotal * plan.hourlyRate)} brutto</Badge> : null}
              <Badge>
                {diff === 0 ? 'tyle samo w drugim wariancie' : `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))} godz. względem drugiego wariantu`}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="lg" onClick={() => run('pdf')} disabled={busy !== null}>
              {busy === 'pdf' ? <Spinner className="text-current" /> : <FileDown className="size-5" />} PDF
            </Button>
            <Button size="lg" variant="outline" onClick={() => run('docx')} disabled={busy !== null}>
              {busy === 'docx' ? <Spinner /> : <FileText className="size-5" />} DOCX
            </Button>
            <Button size="lg" variant="outline" onClick={() => printReport(options)}>
              <Printer className="size-5" /> Drukuj
            </Button>
          </div>
        </div>
        <div className="relative flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line bg-surface-2/40 px-6 py-4">
          <span className="text-[13px] font-medium text-muted">Dokument zawiera:</span>
          <Toggle checked={options.weekly} onChange={toggle('weekly')} label="Tabelę tygodniową" />
          <Toggle checked={options.monthly} onChange={toggle('monthly')} label="Rozliczenie miesięczne" />
          <Toggle checked={options.events} onChange={toggle('events')} label="Wydarzenia" />
          <Toggle checked={options.steps} onChange={toggle('steps')} label="Obliczenia i uwagi" />
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => downloadPlanBackup(plan, report.fileBaseName)}>
              <Save className="size-3.5" /> Zapisz kopię
            </Button>
            <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
              <FolderOpen className="size-3.5" /> Wczytaj kopię
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  replacePlan(await readPlanBackup(file));
                  toast.success('Wczytano kopię kalkulatora.');
                } catch (error) {
                  toast.error((error as Error).message);
                }
              }}
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <CardHeader
            icon={<TableProperties className="size-5" />}
            title="Rozliczenie miesiąc po miesiącu"
            description="Księgowość rozlicza pełne miesiące. Rozwiń miesiąc, aby zobaczyć obliczenia albo dopisać zastępstwa i nieobecności."
          />
          <CardBody>
            <div className="scroll-thin -mx-2 overflow-x-auto px-2">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-xs text-muted">
                    <th className="py-2 text-left font-medium">Miesiąc</th>
                    <th className="px-2 text-right font-medium">Nadgodziny</th>
                    <th className="px-2 text-right font-medium">Zastępstwa</th>
                    <th className="px-2 text-right font-medium">Indywid.</th>
                    <th className="px-2 text-right font-medium">Wycieczki</th>
                    <th className="px-2 text-right font-medium">Egzaminy</th>
                    <th className="px-2 text-right font-medium">Inne</th>
                    <th className="px-2 text-right font-medium">Razem</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {result.months.map((m) => {
                    const overtime = plan.variant === 1 ? m.v1.overtime : m.v2.overtime;
                    const e = m.extras;
                    const total = overtime + e.substitutions + e.individual + e.trips + e.exams + e.other;
                    const expanded = open === m.monthKey;
                    const adj = plan.monthly[m.monthKey];
                    const cell = (n: number) => (n ? fmt(n) : <span className="text-muted/50">—</span>);
                    return (
                      <Fragment key={m.monthKey}>
                        <tr
                          className="cursor-pointer border-t border-line transition-colors hover:bg-surface-2/60"
                          onClick={() => setOpen(expanded ? null : m.monthKey)}
                        >
                          <td className="py-2.5 font-medium">{m.label}</td>
                          <td className="num px-2 text-right font-semibold text-brand">{overtime}</td>
                          <td className="num px-2 text-right">{cell(e.substitutions)}</td>
                          <td className="num px-2 text-right">{cell(e.individual)}</td>
                          <td className="num px-2 text-right">{cell(e.trips)}</td>
                          <td className="num px-2 text-right">{cell(e.exams)}</td>
                          <td className="num px-2 text-right">{cell(e.other)}</td>
                          <td className="num px-2 text-right font-semibold">{fmt(total)}</td>
                          <td>
                            <button
                              type="button"
                              aria-label={`Szczegóły: ${m.label}`}
                              aria-expanded={expanded}
                              className="grid size-7 place-items-center rounded-md text-muted"
                            >
                              <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
                            </button>
                          </td>
                        </tr>
                        <AnimatePresence initial={false}>
                          {expanded && (
                            <tr>
                              <td colSpan={9} className="p-0">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="grid gap-4 border-t border-dashed border-line bg-surface-2/40 p-4 md:grid-cols-2">
                                    <div className="space-y-2 text-[13px]">
                                      {plan.variant === 1 ? (
                                        <>
                                          <p className="font-medium">Nieobecność w miesiącu (wariant 1)</p>
                                          <p className="num font-mono text-xs text-muted">
                                            {m.v1.monthlyOvertime} : {m.v1.workdays} ={' '}
                                            {fmt2(m.v1.perDay)} · {fmt2(m.v1.perDay)} × {fmt(m.v1.absenceDays)} ={' '}
                                            {fmt2(m.v1.deductionRaw)} → {m.v1.deduction}
                                          </p>
                                          <p className="num font-mono text-xs text-muted">
                                            {m.v1.monthlyOvertime} − {m.v1.deduction} ={' '}
                                            <strong className="text-ink">{m.v1.overtime} godz. do wypłaty</strong>
                                          </p>
                                          <label className="flex max-w-xs items-center gap-3 pt-1">
                                            <span className="text-xs text-muted">Dni nieobecności</span>
                                            <NumberField
                                              className="w-28"
                                              value={adj?.absenceDays ?? m.v1.absenceDaysAuto}
                                              min={0}
                                              max={31}
                                              step={0.5}
                                              onChange={(v) => setMonthly(m.monthKey, { absenceDays: v })}
                                              aria-label={`Dni nieobecności — ${m.label}`}
                                            />
                                          </label>
                                          <p className="text-xs text-muted">
                                            Z wydarzeń: {fmt(m.v1.absenceDaysAuto)} dnia
                                            {adj?.absenceDays !== undefined && (
                                              <button
                                                type="button"
                                                className="ml-2 text-brand underline"
                                                onClick={() => unsetMonthly(m.monthKey, 'absenceDays')}
                                              >
                                                wróć do wartości z wydarzeń
                                              </button>
                                            )}
                                          </p>
                                        </>
                                      ) : (
                                        <>
                                          <p className="font-medium">Wariant 2 w tym miesiącu</p>
                                          <p className="text-xs text-muted">
                                            Godziny {fmt(m.v2.hours)} − pensum uśrednione {fmt2(m.v2.pensum)} ={' '}
                                            {fmt2(m.v2.overtimeRaw)} → <strong className="text-ink">{m.v2.overtime} godz.</strong>
                                          </p>
                                        </>
                                      )}
                                    </div>
                                    <div className="space-y-2 text-[13px]">
                                      <p className="font-medium">Dopisz ręcznie (opcjonalnie)</p>
                                      <label className="flex items-center justify-between gap-3">
                                        <span className="text-xs text-muted">Zastępstwa dodatkowo</span>
                                        <NumberField
                                          className="w-28"
                                          value={adj?.substitutions ?? 0}
                                          min={0}
                                          max={400}
                                          step={0.5}
                                          suffix="godz."
                                          aria-label={`Zastępstwa — ${m.label}`}
                                          onChange={(v) => setMonthly(m.monthKey, { substitutions: v })}
                                        />
                                      </label>
                                      <label className="flex items-center justify-between gap-3">
                                        <span className="text-xs text-muted">Indywidualne (wg dziennika)</span>
                                        <NumberField
                                          className="w-28"
                                          value={adj?.individual ?? e.individual}
                                          min={0}
                                          max={400}
                                          step={0.5}
                                          suffix="godz."
                                          aria-label={`Nauczanie indywidualne — ${m.label}`}
                                          onChange={(v) => setMonthly(m.monthKey, { individual: v })}
                                        />
                                      </label>
                                      <p className="text-xs text-muted">Płacone tylko za zajęcia z tematem i frekwencją w dzienniku ucznia.</p>
                                    </div>
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line font-semibold">
                    <td className="py-3">Razem</td>
                    <td className="num px-2 text-right text-brand">{report.monthlyTotal[0]}</td>
                    {report.monthlyTotal.slice(1).map((v, i) => (
                      <td key={i} className="num px-2 text-right">{v}</td>
                    ))}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <CardHeader icon={<Scale className="size-5" />} title="Wariant 1 czy 2?" description="Różnica w godzinach nadliczbowych w skali roku." />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {([1, 2] as const).map((v) => {
                  const total = v === 1 ? result.v1.total : result.v2.total;
                  const best = total >= Math.max(result.v1.total, result.v2.total);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => patch({ variant: v })}
                      className={cn(
                        'rounded-2xl border p-3.5 text-left transition-all',
                        plan.variant === v ? 'border-brand bg-brand-soft ring-4 ring-brand/10' : 'border-line hover:border-brand/40',
                      )}
                    >
                      <p className="text-xs text-muted">Wariant {v}</p>
                      <p className="num mt-1 text-2xl font-semibold">{total}</p>
                      <p className="text-xs text-muted">godz. w roku</p>
                      {best && result.v1.total !== result.v2.total && <Badge tone="ok" className="mt-2">więcej godzin</Badge>}
                    </button>
                  );
                })}
              </div>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barGap={2}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: 'var(--surface-2)' }}
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }}
                      labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string } | undefined)?.full ?? ''}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Wariant 1" fill="var(--brand)" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="Wariant 2" fill="var(--accent)" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          {plan.variant === 1 && (
            <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <CardHeader title="Obliczenia — wariant 1" />
              <CardBody>
                <V1Steps v1={result.v1} settings={settings} />
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <Callout title="Jak zaokrąglamy i co jest liczone osobno">
        Nadgodziny miesięczne zaokrąglamy do pełnych godzin ({settings.rounding === 'nearest' ? 'do najbliższej' : settings.rounding === 'up' ? 'w górę' : 'w dół'}),
        a odliczenie za nieobecność liczymy jako (nadgodziny miesięczne ÷ dni robocze) × dni nieobecności. Zastępstwa,
        nauczanie indywidualne, wycieczki i egzaminy ustne są dodawane oddzielnie i nie wchodzą do uśredniania.
      </Callout>
    </div>
  );
}
