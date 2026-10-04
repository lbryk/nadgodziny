import {
  DAY_KIND_LABEL,
  WEEKDAY_SHORT_PL,
  formatCell,
  formatDM,
  isEditableKind,
  parseCell,
  resolveDay,
  type DayCalc,
  type DayKind,
  type RowCalc,
} from '@nadgodziny/core';
import { Eraser, RotateCcw, Sigma, Undo2 } from 'lucide-react';
import { motion } from 'motion/react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Callout } from '../../components/ui/callout';
import { Card, CardBody, CardHeader } from '../../components/ui/card';
import { CountUp } from '../../components/ui/count-up';
import { NumberField } from '../../components/ui/field';
import { Toggle } from '../../components/ui/switch';
import { Tip } from '../../components/ui/tooltip';
import { useCalc } from '../../hooks/calc-context';
import { cn } from '../../lib/cn';
import { fmt, fmt2 } from '../../lib/format';
import { usePlanStore } from '../../state/plan-store';
import { GROUP_LABEL } from './groups';

const KIND_VAR: Record<DayKind | 'void', string> = {
  school: 'transparent',
  weekend: 'var(--k-outside)',
  outside: 'var(--k-outside)',
  holiday: 'var(--k-holiday)',
  break: 'var(--k-break)',
  ferie: 'var(--k-ferie)',
  den: 'var(--k-den)',
  director: 'var(--k-director)',
  exam: 'var(--k-exam)',
  other: 'var(--k-other)',
  void: 'var(--k-void)',
};

interface DayCellProps {
  date: string;
  kind: DayKind | 'void';
  label?: string;
  text: string;
  individual: boolean;
  overridden: boolean;
  excluded: boolean;
  eventTitles: string;
  dropped: string;
  coords: string;
  onCommit: (date: string, raw: string) => void;
  onReset: (date: string) => void;
}

const DayCell = memo(function DayCell({
  date,
  kind,
  label,
  text,
  individual,
  overridden,
  excluded,
  eventTitles,
  dropped,
  coords,
  onCommit,
  onReset,
}: DayCellProps) {
  const [invalid, setInvalid] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  if (!isEditableKind(kind)) {
    const bg = KIND_VAR[kind];
    const title =
      kind === 'void' ? '' : `${formatDM(date)} — ${label ?? DAY_KIND_LABEL[kind as DayKind]}`;
    return (
      <td className="p-0.5">
        <Tip content={title}>
          <div
            className={cn('h-9 rounded-md', kind === 'void' ? 'hatch opacity-80' : 'hatch')}
            style={{ backgroundColor: bg }}
            aria-label={title || undefined}
          />
        </Tip>
      </td>
    );
  }

  const tip = [
    kind === 'exam' ? `${formatDM(date)} — ${label ?? 'Egzaminy'}: godziny niepłatne` : '',
    eventTitles && `Wydarzenie: ${eventTitles}`,
    dropped && `Nie odbywają się: ${dropped}`,
    overridden && 'Zmienione ręcznie — kliknij ↺, aby przywrócić plan',
  ]
    .filter(Boolean)
    .join(' · ');

  /** Spreadsheet-style vertical navigation between editable cells of the same weekday. */
  const move = (dr: 1 | -1) => {
    const [r, c] = coords.split(':').map(Number) as [number, number];
    const inputs = Array.from(
      ref.current?.closest('table')?.querySelectorAll<HTMLInputElement>('input[data-coords]') ?? [],
    ).map((el) => {
      const [rr, cc] = (el.dataset.coords ?? '0:0').split(':').map(Number) as [number, number];
      return { el, rr, cc };
    });
    const candidates = inputs.filter((x) => x.cc === c && (dr > 0 ? x.rr > r : x.rr < r));
    (dr > 0 ? candidates[0] : candidates[candidates.length - 1])?.el.focus();
  };

  return (
    <td className="relative p-0.5">
      <Tip content={tip}>
        <div className="relative">
          <input
            ref={ref}
            data-coords={coords}
            defaultValue={text}
            key={text}
            inputMode="decimal"
            aria-label={`${formatDM(date)}, liczba godzin`}
            aria-invalid={invalid || undefined}
            placeholder="·"
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => {
              const raw = e.target.value;
              if (raw.trim() === text.trim()) return setInvalid(false);
              if (!parseCell(raw).ok) {
                setInvalid(true);
                e.target.value = text;
                toast.error('Wpisz liczbę godzin, np. 3 lub 3+1 (3 godz. + 1 indywidualna).');
                return;
              }
              setInvalid(false);
              onCommit(date, raw);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault();
                e.currentTarget.blur();
                move(1);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                e.currentTarget.blur();
                move(-1);
              } else if (e.key === 'Escape') {
                e.currentTarget.value = text;
                e.currentTarget.blur();
              }
            }}
            style={kind === 'exam' ? { backgroundColor: KIND_VAR.exam } : undefined}
            className={cn(
              'num h-9 w-full min-w-10 rounded-md border bg-surface text-center text-sm transition-shadow focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none',
              overridden ? 'border-brand/60 font-semibold' : 'border-line',
              excluded && 'text-muted line-through decoration-1',
              invalid && 'border-danger ring-2 ring-danger/30',
              individual && !excluded && 'text-[var(--k-ind)]',
            )}
          />
          {(overridden || eventTitles) && (
            <span
              className={cn(
                'pointer-events-none absolute top-0.5 right-0.5 size-1.5 rounded-full',
                eventTitles ? 'bg-warn' : 'bg-brand',
              )}
            />
          )}
          {overridden && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Przywróć wartość z przydziału"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onReset(date)}
              className="absolute -top-1.5 -left-1.5 hidden size-4 place-items-center rounded-full bg-brand text-white shadow group-hover/row:grid dark:text-[#0b0e1a]"
            >
              <Undo2 className="size-2.5" />
            </button>
          )}
        </div>
      </Tip>
    </td>
  );
});

function cellText(day: DayCalc | null): string {
  if (!day) return '';
  return formatCell(day.regular, day.individual);
}

export default function WeeklyTableStep() {
  const { plan, settings, calendar, result } = useCalc();
  const { setOverride, clearOverrides, patch } = usePlanStore();
  const v2 = result.v2;
  const [manualAvg, setManualAvg] = useState(plan.avgPensumOverride !== null);

  const eventTitleById = useMemo(
    () => new Map(plan.events.map((e) => [e.id, e.title] as const)),
    [plan.events],
  );

  const commit = useCallback(
    (date: string, raw: string) => {
      const parsed = parseCell(raw);
      if (!parsed.ok) return;
      const kind = calendar.days[date]?.kind ?? 'school';
      // the plan without any manual edit tells us what the timetable would give for this day
      const baseline = resolveDay(date, kind, { ...plan, cellOverrides: {} }, settings);
      const same = baseline.regular === parsed.regular && baseline.individual === parsed.individual;
      setOverride(date, same ? null : formatCell(parsed.regular, parsed.individual) || '0');
    },
    [calendar.days, plan, settings, setOverride],
  );
  const reset = useCallback((date: string) => setOverride(date, null), [setOverride]);

  const overrideCount = Object.keys(plan.cellOverrides).length;
  const rowsByMonth = v2.months;
  let rowIndex = -1;

  const weekRowDates = (r: RowCalc) => r.row.cells.map((c) => c.date).filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <CardHeader
          icon={<Sigma className="size-5" />}
          title="Pensum uśrednione"
          description="Najpierw trzeba wypracować pensum średnio w całym roku — dopiero godziny powyżej uśrednionego progu są ponadwymiarowe."
        />
        <CardBody className="grid gap-5 lg:grid-cols-[1fr_auto]">
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Tygodnie z zajęciami" value={`${fmt(v2.weeks)}`} />
            <Metric
              label="Roczny obowiązek"
              value={`${fmt(v2.annualObligation)} godz.`}
              hint={`${fmt(result.pensum)} × ${fmt(v2.weeks)}`}
            />
            <Metric label="Twoje godziny" value={`${fmt(v2.annualHours)} godz.`} />
            <Metric
              label="Pensum uśrednione"
              value={v2.averagedPensum === null ? '—' : `${fmt2(v2.averagedPensum)} godz./tydz.`}
              accent
              hint={
                v2.averagedPensumSource === 'manual'
                  ? 'ustawione ręcznie'
                  : v2.averagedPensum === null
                    ? 'brak nadwyżki w roku'
                    : 'liczone automatycznie'
              }
            />
          </dl>
          <div className="flex min-w-60 flex-col gap-2 lg:items-end">
            <Toggle
              checked={manualAvg}
              onChange={(on) => {
                setManualAvg(on);
                patch({ avgPensumOverride: on ? (v2.averagedPensum ?? plan.contractHours) : null });
              }}
              label="Ustaw pensum uśrednione ręcznie"
            />
            {manualAvg && (
              <NumberField
                className="w-40"
                value={plan.avgPensumOverride ?? 0}
                min={1}
                max={60}
                step={0.5}
                suffix="godz."
                aria-label="Pensum uśrednione"
                onChange={(v) => patch({ avgPensumOverride: v > 0 ? v : null })}
              />
            )}
          </div>
        </CardBody>
      </Card>

      <Card
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <CardHeader
          title={`Tabela rozliczenia godzin zajęć dydaktycznych ${calendar.label}`}
          description="Godziny wypełniły się z Twojego przydziału (po odjęciu klas 5 po 30 kwietnia, praktyk i wydarzeń). Kliknij komórkę, aby wpisać własną wartość — np. 3 albo 3+1 (3 godz. i 1 indywidualna)."
          actions={
            <Button
              size="sm"
              variant="outline"
              disabled={overrideCount === 0}
              onClick={() => {
                clearOverrides();
                toast.success('Przywrócono wartości z przydziału.');
              }}
            >
              <RotateCcw className="size-3.5" /> Cofnij ręczne zmiany
              {overrideCount > 0 && ` (${overrideCount})`}
            </Button>
          }
        />
        <CardBody className="space-y-4">
          <Legend />

          <div className="scroll-thin -mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[820px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="sticky left-0 z-10 bg-surface py-2 pr-2 text-left font-medium">
                    Tydzień
                  </th>
                  {WEEKDAY_SHORT_PL.map((d) => (
                    <th key={d} className="w-[9%] min-w-11 py-2 font-medium">
                      {d}
                    </th>
                  ))}
                  <th className="w-[9%] px-2 text-right font-medium">Razem</th>
                  <th className="w-[11%] px-2 text-right font-medium">Pensum uśr.</th>
                  <th className="w-[12%] px-2 text-right font-medium">Godz. ponadwym.</th>
                  <th className="w-8" />
                </tr>
              </thead>
              {rowsByMonth.map((month, mi) => (
                <tbody key={month.monthKey} id={`m-${month.monthKey}`} className="scroll-mt-28">
                  <tr>
                    <td colSpan={10} className="pt-5 pb-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold tracking-tight">
                          {month.label}
                        </span>
                        <Badge>{calendar.months[mi]!.workdays} dni roboczych</Badge>
                        <Badge tone="brand">{calendar.months[mi]!.teachingDays} dni zajęć</Badge>
                      </div>
                    </td>
                  </tr>
                  {month.rows.map((rc) => {
                    rowIndex += 1;
                    const r = rowIndex;
                    const dates = weekRowDates(rc);
                    const hasOverride = dates.some((d) => plan.cellOverrides[d] !== undefined);
                    const dead = rc.countedDays === 0;
                    return (
                      <tr key={rc.row.id} className="group/row">
                        <td className="sticky left-0 z-10 bg-surface py-0.5 pr-2 text-[13px] whitespace-nowrap text-muted num">
                          {rc.row.label}
                        </td>
                        {rc.row.cells.map((cell, c) => {
                          if (!cell.date) {
                            return (
                              <DayCell
                                key={c}
                                date=""
                                kind="void"
                                text=""
                                individual={false}
                                overridden={false}
                                excluded={false}
                                eventTitles=""
                                dropped=""
                                coords=""
                                onCommit={commit}
                                onReset={reset}
                              />
                            );
                          }
                          const day = result.days[cell.date] ?? null;
                          return (
                            <DayCell
                              key={cell.date}
                              date={cell.date}
                              kind={cell.kind}
                              label={cell.label}
                              text={cellText(day)}
                              individual={!!day && day.individual > 0 && day.regular === 0}
                              overridden={!!day?.overridden}
                              excluded={!!day?.examExcluded}
                              eventTitles={(day?.eventIds ?? [])
                                .map((id) => eventTitleById.get(id) ?? '')
                                .filter(Boolean)
                                .join(', ')}
                              dropped={(day?.droppedGroups ?? [])
                                .map((g) => GROUP_LABEL[g])
                                .join(', ')}
                              coords={`${r}:${c}`}
                              onCommit={commit}
                              onReset={reset}
                            />
                          );
                        })}
                        <td className="num px-2 text-right font-medium">
                          {dead ? '' : fmt(rc.hours)}
                        </td>
                        <td className="num px-2 text-right text-muted">
                          {dead ? '' : fmt2(rc.pensum)}
                        </td>
                        <td className="px-1.5 text-right">
                          {!dead && (
                            <span
                              className={cn(
                                'num inline-block min-w-14 rounded-md px-2 py-1 font-medium',
                                rc.overtime > 0 ? 'bg-ok/12 text-ok' : 'text-muted',
                              )}
                            >
                              {fmt2(rc.overtime)}
                            </span>
                          )}
                        </td>
                        <td className="w-8">
                          <div className="flex opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                            <Tip content="Wyzeruj ten tydzień (nieobecność)">
                              <button
                                type="button"
                                aria-label="Wyzeruj tydzień"
                                className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
                                onClick={() => {
                                  for (const d of dates) {
                                    if (isEditableKind(calendar.days[d]?.kind ?? 'outside'))
                                      setOverride(d, '0');
                                  }
                                }}
                              >
                                <Eraser className="size-3.5" />
                              </button>
                            </Tip>
                            {hasOverride && (
                              <Tip content="Przywróć ten tydzień wg przydziału">
                                <button
                                  type="button"
                                  aria-label="Przywróć tydzień"
                                  className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
                                  onClick={() => clearOverrides(dates)}
                                >
                                  <Undo2 className="size-3.5" />
                                </button>
                              </Tip>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan={6} className="pt-1.5 pb-1 text-right text-xs text-muted">
                      Razem w miesiącu
                    </td>
                    <td className="num px-2 pt-1.5 text-right text-sm font-semibold">
                      {fmt(month.hours)}
                    </td>
                    <td className="num px-2 pt-1.5 text-right text-sm text-muted">
                      {fmt2(month.pensum)}
                    </td>
                    <td className="px-1.5 pt-1.5 text-right">
                      <motion.span
                        key={month.overtime}
                        initial={{ scale: 0.85, opacity: 0.4 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={cn(
                          'num inline-flex items-baseline gap-1 rounded-lg px-2.5 py-1 text-sm font-semibold',
                          month.overtime > 0
                            ? 'bg-brand text-white dark:text-[#0b0e1a]'
                            : 'bg-surface-2 text-muted',
                        )}
                      >
                        {month.overtime}{' '}
                        <span className="text-[10px] font-medium opacity-80">godz.</span>
                      </motion.span>
                    </td>
                    <td />
                  </tr>
                  <tr>
                    <td colSpan={10} className="pb-1">
                      <div className="h-px bg-line" />
                    </td>
                  </tr>
                </tbody>
              ))}
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-soft p-4">
            <p className="text-sm text-muted">
              Nadgodziny w całym roku szkolnym (wariant 2, sumy miesięcy w pełnych godzinach)
            </p>
            <p className="flex items-baseline gap-2">
              <CountUp
                value={v2.total}
                className="num text-3xl font-semibold tracking-tight text-brand"
              />
              <span className="text-muted">godz.</span>
            </p>
          </div>

          <Callout title="Praktyki i godziny, które znikają">
            Godziny, które znikną z powodu praktyk uczniowskich, trzeba wypracować wcześniej, żeby w
            miesiącu z praktyką mieć zapłaconą podstawę i/lub ewentualne nadgodziny — właśnie
            dlatego pensum uśrednione bywa wyższe niż 18. Dodaj praktyki w zakładce „Wydarzenia”.
            Dni egzaminów (żółte) są niepłatne i nie wchodzą do rozliczenia.
          </Callout>
        </CardBody>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-3.5',
        accent ? 'border-brand/30 bg-brand-soft' : 'border-line bg-surface-2/60',
      )}
    >
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num mt-1 text-lg font-semibold tracking-tight">{value}</dd>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function Legend() {
  const items: { label: string; style: React.CSSProperties; hatch?: boolean }[] = [
    {
      label: 'Dzień zajęć',
      style: { backgroundColor: 'var(--surface)', border: '1px solid var(--line)' },
    },
    { label: 'Święto / przerwa', style: { backgroundColor: 'var(--k-holiday)' }, hatch: true },
    { label: 'Ferie', style: { backgroundColor: 'var(--k-ferie)' }, hatch: true },
    { label: 'Dzień wolny / DEN', style: { backgroundColor: 'var(--k-den)' }, hatch: true },
    { label: 'Egzaminy (niepłatne)', style: { backgroundColor: 'var(--k-exam)' } },
    { label: 'Poza miesiącem', style: { backgroundColor: 'var(--k-void)' }, hatch: true },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={cn('size-3.5 rounded', i.hatch && 'hatch')} style={i.style} />
          {i.label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-brand" /> zmiana ręczna
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-warn" /> wydarzenie
      </li>
      <li className="flex items-center gap-1.5">
        <span className="font-semibold text-[var(--k-ind)]">3+1</span> indywidualne (zielone)
      </li>
    </ul>
  );
}
