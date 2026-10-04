import { WEEKDAY_SHORT_PL, addDays, weekdayOf, type Calendar, type DayKind, type MonthInfo } from '@nadgodziny/core';
import { cn } from '../../lib/cn';

export const KIND_BG: Record<DayKind, string> = {
  school: 'transparent',
  weekend: 'transparent',
  outside: 'var(--k-outside)',
  holiday: 'var(--k-holiday)',
  break: 'var(--k-break)',
  ferie: 'var(--k-ferie)',
  den: 'var(--k-den)',
  director: 'var(--k-director)',
  exam: 'var(--k-exam)',
  other: 'var(--k-other)',
};

const WEEKDAYS_FULL = [...WEEKDAY_SHORT_PL, 'So', 'Nd'];

export function MonthGrid({
  month,
  calendar,
  selected,
  onSelect,
  today,
}: {
  month: MonthInfo;
  calendar: Calendar;
  selected: string | null;
  onSelect: (date: string) => void;
  today: string;
}) {
  const offset = weekdayOf(month.firstDate) - 1;
  const total = Number(month.lastDate.slice(8, 10));
  const cells = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: total }, (_, i) => addDays(month.firstDate, i)),
  ];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted uppercase">
        {WEEKDAYS_FULL.map((d, i) => (
          <span key={d} className={i >= 5 ? 'opacity-60' : ''}>
            {d}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <span key={`e${i}`} />;
          const day = calendar.days[date];
          const kind = day?.kind ?? 'school';
          const weekend = weekdayOf(date) >= 6;
          const off = kind !== 'school' && kind !== 'weekend';
          const isSelected = selected === date;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-label={`${Number(date.slice(8))} — ${day?.label ?? (weekend ? 'weekend' : 'dzień zajęć')}`}
              aria-pressed={isSelected}
              style={{ backgroundColor: off ? KIND_BG[kind] : undefined }}
              className={cn(
                'num relative grid aspect-square place-items-center rounded-lg text-xs transition-all hover:scale-110 hover:shadow-md',
                !off && !weekend && 'bg-surface-2/70',
                !off && weekend && 'text-muted/60',
                off && kind === 'exam' && 'font-semibold',
                date === today && 'ring-2 ring-brand ring-offset-1 ring-offset-surface',
                isSelected && 'z-10 scale-110 shadow-lg ring-2 ring-ink',
              )}
            >
              {Number(date.slice(8))}
              {off && kind !== 'outside' && !weekend && <span className="hatch absolute inset-0 rounded-lg" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
