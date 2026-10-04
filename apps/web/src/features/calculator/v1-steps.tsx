import type { Settings, Variant1Result } from '@nadgodziny/core';
import { fmt, fmt2 } from '../../lib/format';
import { cn } from '../../lib/cn';

/** The director's formula, written out with the teacher's own numbers. */
export function V1Steps({
  v1,
  settings,
  className,
}: {
  v1: Variant1Result;
  settings: Settings;
  className?: string;
}) {
  const w = settings.weights;
  const { hours } = v1;
  const terms = [
    hours.k12 > 0 && `${fmt(hours.k12)}×${fmt(w.k12)}`,
    hours.k34 > 0 && `${fmt(hours.k34)}×${fmt(w.k34)}`,
    hours.k5 > 0 && `${fmt(hours.k5)}×${fmt(w.k5)}`,
  ].filter(Boolean);

  const rows: { label: string; math: string; result: string; strong?: boolean }[] = [
    {
      label: 'Godziny ważone',
      math: terms.length ? terms.join(' + ') : '—',
      result: fmt2(v1.weightedHours),
    },
    {
      label: 'Nadgodziny tygodniowo',
      math: `${fmt2(v1.weightedHours)} − ${fmt(v1.pensum)}`,
      result: `${fmt2(v1.weeklyOvertime)} godz.`,
    },
    {
      label: 'Nadgodziny miesięcznie',
      math: `${fmt2(v1.weeklyOvertime)} × ${fmt2(settings.weeksPerMonth)} = ${fmt2(v1.monthlyRaw)}`,
      result: `${v1.monthlyRounded} godz.`,
      strong: true,
    },
  ];

  return (
    <dl
      className={cn(
        'divide-y divide-line rounded-xl border border-line bg-surface-2/50 text-sm',
        className,
      )}
    >
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3.5 py-2.5"
        >
          <dt className="text-muted">{r.label}</dt>
          <dd className="num flex items-baseline gap-3">
            <span className="font-mono text-xs text-muted">{r.math}</span>
            <span
              className={cn(
                'min-w-16 text-right',
                r.strong ? 'text-base font-semibold text-brand' : 'font-medium',
              )}
            >
              {r.result}
            </span>
          </dd>
        </div>
      ))}
      {v1.weeklyShortfall > 0 && (
        <div className="px-3.5 py-2.5 text-[13px] text-warn">
          Przydział ważony jest o {fmt2(v1.weeklyShortfall)} godz. niższy niż wymiar — nadgodzin
          brak.
        </div>
      )}
    </dl>
  );
}
