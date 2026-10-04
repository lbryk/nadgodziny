import { CalendarClock, Info, ScanText } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'motion/react';
import { WEEKDAY_SHORT_PL } from '@nadgodziny/core';
import { Button } from '../../components/ui/button';
import { Callout } from '../../components/ui/callout';
import { Card, CardBody, CardHeader } from '../../components/ui/card';
import { CountUp } from '../../components/ui/count-up';
import { Tip } from '../../components/ui/tooltip';
import { useCalc } from '../../hooks/calc-context';
import { cn } from '../../lib/cn';
import { fmt, fmt2 } from '../../lib/format';
import { usePlanStore } from '../../state/plan-store';
import { distribute, ROWS } from './groups';
import { PlanImportDialog } from './plan-import/plan-import-dialog';
import { V1Steps } from './v1-steps';

function HourCell({
  value,
  onChange,
  label,
  green,
  max = 12,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  green?: boolean;
  /** Upper bound: 12 lessons for a single day, 60 for a weekly total. */
  max?: number;
}) {
  const text = value === 0 ? '' : String(value).replace('.', ',');
  const commit = (raw: string) => {
    const n = Number(raw.replace(',', '.'));
    onChange(
      raw.trim() === '' || Number.isNaN(n) ? 0 : Math.min(max, Math.max(0, Math.round(n * 2) / 2)),
    );
  };
  return (
    <input
      key={text}
      defaultValue={text}
      aria-label={label}
      inputMode="decimal"
      placeholder="0"
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          onChange(Math.min(max, Math.max(0, value + (e.key === 'ArrowUp' ? 1 : -1))));
        }
      }}
      className={cn(
        'num h-11 w-full min-w-9 rounded-xl border border-line bg-surface text-center text-[15px] font-medium transition-shadow placeholder:text-muted/40 focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none',
        green && 'text-[var(--k-ind)]',
        value > 0 && 'border-brand/35 bg-brand-soft/50',
      )}
    />
  );
}

export function TimetableStep() {
  const { plan, settings, result } = useCalc();
  const { setTimetableCell, setTimetableRow } = usePlanStore();
  const totals = result.v1.hours;
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="grid gap-6">
      <PlanImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <CardHeader
          icon={<CalendarClock className="size-5" />}
          title="Przydział godzin w tygodniu"
          description="Wpisz, ile godzin lekcyjnych masz w każdym dniu — osobno dla klas 1–2, 3–4 i 5. To samo zestawienie zasila oba warianty rozliczenia."
          actions={
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              data-tour="plan-import"
              data-testid="plan-import-open"
            >
              <ScanText className="size-4" /> Wczytaj z planu lekcji
            </Button>
          }
        />
        <CardBody>
          <div className="scroll-thin -mx-2 overflow-x-auto px-2 pb-1">
            <table className="w-full min-w-[440px] border-separate border-spacing-y-2">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="text-left font-medium" />
                  {WEEKDAY_SHORT_PL.map((d) => (
                    <th key={d} className="w-[13%] font-medium">
                      {d}
                    </th>
                  ))}
                  <th className="w-[15%] font-medium">
                    <Tip content="Wpisz sumę tygodniową — rozłożymy ją równo na dni. Potem możesz poprawić pojedyncze dni.">
                      <span className="inline-flex cursor-help items-center gap-1">
                        Razem <Info className="size-3" />
                      </span>
                    </Tip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const values = plan.timetable[row.id];
                  const sum = values.reduce((a, b) => a + b, 0);
                  const weight = settings.weights[row.weightKey];
                  return (
                    <tr key={row.id}>
                      <td className="pr-3">
                        <div className="flex items-center gap-2.5">
                          <span className={cn('size-2.5 rounded-full', row.dot)} />
                          <div className="leading-tight">
                            <div className="text-sm font-medium whitespace-nowrap">
                              <span className="sm:hidden">{row.short}</span>
                              <span className="hidden sm:inline">{row.label}</span>
                            </div>
                            <div className="text-[11px] text-muted">
                              {row.id === 'ind' ? 'zielone w tabeli' : `waga ${fmt(weight)}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      {values.map((v, i) => (
                        <td key={i} className="px-1">
                          <HourCell
                            value={v}
                            green={row.id === 'ind'}
                            label={`${row.label}, ${WEEKDAY_SHORT_PL[i]}`}
                            onChange={(h) => setTimetableCell(row.id, i, h)}
                          />
                        </td>
                      ))}
                      <td className="pl-2">
                        <HourCell
                          value={sum}
                          green={row.id === 'ind'}
                          label={`${row.label} — suma tygodniowa`}
                          max={60}
                          onChange={(total) => setTimetableRow(row.id, distribute(total))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile
              label="Przydział razem"
              value={totals.k12 + totals.k34 + totals.k5}
              unit="godz."
            />
            <Tile
              label="Godziny ważone"
              value={result.v1.weightedHours}
              unit=""
              decimals={2}
              accent
            />
            <Tile label="Wymiar etatu" value={result.pensum} unit="godz." />
            <Tile
              label="Nadgodziny / tydzień"
              value={result.v1.weeklyOvertime}
              unit="godz."
              decimals={2}
              accent
            />
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <CardHeader
            title="Jak liczymy — wariant 1"
            description="To samo, co w przykładzie dyrektora, ale na Twoich liczbach."
          />
          <CardBody>
            <V1Steps v1={result.v1} settings={settings} />
            <p className="mt-3 text-xs text-muted">
              Wagi: kl. 1–2 = {fmt(settings.weights.k12)}, kl. 3–4 = {fmt(settings.weights.k34)},
              kl. 5 = {fmt(settings.weights.k5)}; {fmt2(settings.weeksPerMonth)} tygodnia w
              miesiącu. Wagi ustala administrator.
            </p>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Callout tone="info" title="Zajęcia zawodowe w klasach 5">
            Do Bożego Narodzenia realizowane są w podwojonej liczbie, ale płacone w „pojedynczej” —
            wynagrodzenie jest wypłacane również od 1 stycznia 2027. W wariancie 1 wpisz liczbę
            „pojedynczą”. W wariancie 2 tabela tygodniowa uwzględni rzeczywisty rozkład.
          </Callout>
          <Callout tone="info" title="Języki i matematyka w klasach 5">
            Do świąt godzin jest mniej, a po 1 stycznia 2027 więcej. W wariancie 1 średnia i tak
            daje uśrednione nadgodziny — niezależnie od tego, czy pracujesz więcej czy mniej.
          </Callout>
          <Callout tone="warn" title="Zastępstwa i nauczanie indywidualne">
            Zastępstwa są dodawane oddzielnie (dodasz je w zakładce „Wydarzenia”). Indywidualne
            rozliczane jest osobno i tylko za zajęcia z tematem i frekwencją w dzienniku ucznia.
          </Callout>
        </div>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  unit,
  decimals = 0,
  accent,
}: {
  label: string;
  value: number;
  unit: string;
  decimals?: number;
  accent?: boolean;
}) {
  return (
    <motion.div
      layout
      className={cn(
        'rounded-2xl border p-3.5',
        accent ? 'border-brand/30 bg-brand-soft' : 'border-line bg-surface-2/60',
      )}
    >
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <CountUp
          value={value}
          decimals={decimals}
          className="num text-2xl font-semibold tracking-tight"
        />
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </p>
    </motion.div>
  );
}
