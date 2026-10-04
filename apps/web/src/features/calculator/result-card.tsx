import { ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Segmented } from '../../components/ui/segmented';
import { CountUp } from '../../components/ui/count-up';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useCalc } from '../../hooks/calc-context';
import { fmt, fmt2, fmtPln, hoursWord } from '../../lib/format';
import { usePlanStore } from '../../state/plan-store';

/** Sticky live result: the teacher sees the effect of every number they type. */
export function ResultCard({ onOpenResult }: { onOpenResult: () => void }) {
  const { plan, result, settings } = useCalc();
  const patch = usePlanStore((s) => s.patch);
  const { selected } = result;
  const monthly = result.months.map((m) => (plan.variant === 1 ? m.v1.overtime : m.v2.overtime));
  const peak = Math.max(1, ...monthly);
  const hasHours = result.v1.hours.k12 + result.v1.hours.k34 + result.v1.hours.k5 + result.v1.hours.individual > 0;
  const averaged = plan.variant === 2 ? result.v2.averagedPensum : null;

  return (
    <Card
      className="relative overflow-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-brand/15 blur-3xl"
      />
      <div className="relative space-y-5 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted">
            <Sparkles className="size-4 text-brand" /> Twój wynik
          </h2>
          <Segmented
            size="sm"
            aria-label="Wariant rozliczenia"
            value={plan.variant}
            onChange={(variant) => patch({ variant })}
            options={[
              { value: 1, label: 'Wariant 1', hint: 'Uśredniony — jednakowa liczba godzin co miesiąc' },
              { value: 2, label: 'Wariant 2', hint: 'Realny — wg faktycznych godzin w tygodniach' },
            ]}
          />
        </div>

        <div>
          <p className="text-xs text-muted">Nadgodziny do wypłaty w roku szkolnym</p>
          <p className="mt-1 flex items-baseline gap-2">
            <CountUp value={selected.overtimeTotal} className="num text-5xl font-semibold tracking-tight" />
            <span className="text-lg text-muted">{hoursWord(selected.overtimeTotal)}</span>
          </p>
          {selected.extrasTotal > 0 && (
            <p className="mt-1.5 text-sm text-muted">
              + <span className="num font-medium text-ink">{fmt(selected.extrasTotal)}</span> godz. rozliczanych
              odrębnie
            </p>
          )}
          {plan.hourlyRate ? (
            <p className="mt-1 text-sm text-muted">
              Szacunkowo: <span className="num font-medium text-ink">{fmtPln(selected.grandTotal * plan.hourlyRate)}</span> brutto
            </p>
          ) : null}
        </div>

        <div>
          <div className="flex h-16 items-end gap-1" aria-hidden>
            {monthly.map((value, i) => (
              <motion.div
                key={result.months[i]!.monthKey}
                className="flex-1 rounded-t-md bg-gradient-to-t from-brand/70 to-accent/80"
                initial={false}
                animate={{ height: `${Math.max(4, (value / peak) * 100)}%`, opacity: value > 0 ? 1 : 0.35 }}
                transition={{ type: 'spring', stiffness: 220, damping: 26, delay: i * 0.015 }}
                title={`${result.months[i]!.label}: ${value} godz.`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] tracking-wide text-muted uppercase">
            <span>wrz</span>
            <span>cze</span>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Wymiar etatu" value={`${fmt(result.pensum)} godz.`} />
          {plan.variant === 1 ? (
            <Stat label="Godziny ważone" value={fmt2(result.v1.weightedHours)} />
          ) : (
            <Stat label="Pensum uśrednione" value={averaged === null ? '—' : `${fmt2(averaged)} godz.`} />
          )}
          <Stat
            label={plan.variant === 1 ? 'Miesięcznie' : 'Przeciętnie / mies.'}
            value={`${plan.variant === 1 ? result.v1.monthlyRounded : fmt(Math.round((result.v2.total / 10) * 10) / 10)} godz.`}
          />
          <Stat label="Waga tygodnia" value={`${fmt(settings.weeksPerMonth)} tyg./mies.`} />
        </dl>

        {!hasHours && (
          <p className="rounded-xl bg-warn/10 px-3 py-2 text-[13px] text-warn">
            Wpisz przydział godzin, aby zobaczyć nadgodziny.
          </p>
        )}

        <Button variant="primary" className="w-full" onClick={onOpenResult}>
          Zobacz rozliczenie i pobierz <ArrowRight className="size-4" />
        </Button>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2/70 px-3 py-2">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="num mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
