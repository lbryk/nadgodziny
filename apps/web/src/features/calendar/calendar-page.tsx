import {
  DAY_KIND_LABEL,
  WEEKDAY_LONG_PL,
  easterBreak,
  eachDay,
  feriePreset,
  formatDM,
  formatDMY,
  weekdayOf,
  winterBreak,
  type CalendarDay,
  type DayKind,
} from '@nadgodziny/core';
import {
  CalendarArrowDown,
  CalendarCheck2,
  CalendarX2,
  Flag,
  GraduationCap,
  Snowflake,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardBody, CardHeader } from '../../components/ui/card';
import { useCalc } from '../../hooks/calc-context';
import { downloadCalendarIcs } from '../../export/ics';
import { cn } from '../../lib/cn';
import { KIND_BG, MonthGrid } from './month-grid';

const LEGEND: DayKind[] = ['holiday', 'break', 'ferie', 'den', 'director', 'exam', 'other'];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarPage() {
  const { calendar, settings } = useCalc();
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Set<DayKind>>(new Set());
  const today = todayISO();

  const counts = useMemo(() => {
    const out: Partial<Record<DayKind, number>> = {};
    for (const d of Object.values(calendar.days)) {
      if (weekdayOf(d.date) >= 6) continue;
      out[d.kind] = (out[d.kind] ?? 0) + 1;
    }
    return out;
  }, [calendar]);

  const offDays = useMemo(
    () =>
      (Object.values(calendar.days) as CalendarDay[])
        .filter((d) => LEGEND.includes(d.kind) && weekdayOf(d.date) <= 5)
        .filter((d) => filter.size === 0 || filter.has(d.kind))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [calendar, filter],
  );

  const detail = selected ? calendar.days[selected] : null;
  const range = (r: { from: string; to: string }) => `${formatDM(r.from)}–${formatDMY(r.to)}`;
  const keyDates = [
    { icon: GraduationCap, label: 'Początek roku', value: formatDMY(calendar.startDate) },
    {
      icon: Snowflake,
      label: 'Zimowa przerwa',
      value: range(winterBreak(settings.schoolYearStart)),
    },
    {
      icon: CalendarX2,
      label: 'Wiosenna przerwa',
      value: range(easterBreak(settings.schoolYearStart)),
    },
    { icon: Flag, label: 'Koniec zajęć', value: formatDMY(calendar.endDate) },
  ];
  // official term for the configured voivodeship; falls back to the days marked as ferie
  const feriePeriod = (() => {
    const preset = feriePreset(settings.schoolYearStart, settings.voivodeship);
    if (preset) return preset;
    const marked = eachDay(
      `${settings.schoolYearStart + 1}-01-01`,
      `${settings.schoolYearStart + 1}-02-28`,
    ).filter((d) => calendar.days[d]?.kind === 'ferie');
    return marked.length ? { from: marked[0]!, to: marked[marked.length - 1]! } : null;
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Kalendarz roku szkolnego <span className="text-brand">{calendar.label}</span>
          </h1>
          <p className="max-w-2xl text-muted">
            Tabela rozliczeń korzysta z tego kalendarza: święta, przerwy, ferie, Dzień Edukacji
            Narodowej, dni wolne ustalone przez dyrektora i dni egzaminów. Zmiany wprowadza
            administrator.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => downloadCalendarIcs(calendar, settings.schoolName)}
        >
          <CalendarArrowDown className="size-4" /> Pobierz do kalendarza (.ics)
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {keyDates.map(({ icon: Icon, label, value }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
              <Icon className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted">{label}</p>
              <p className="num font-semibold">{value}</p>
            </div>
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card"
        >
          <div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
            <CalendarCheck2 className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted">Ferie zimowe</p>
            <p className="num font-semibold">{feriePeriod ? range(feriePeriod) : 'brak danych'}</p>
          </div>
        </motion.div>
      </div>

      <Card>
        <CardBody className="space-y-4 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            {LEGEND.map((k) => {
              const active = filter.has(k);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setFilter((f) => {
                      const next = new Set(f);
                      if (next.has(k)) next.delete(k);
                      else next.add(k);
                      return next;
                    })
                  }
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                    active ? 'border-ink bg-surface-2' : 'border-line hover:border-ink/40',
                  )}
                >
                  <span className="size-3 rounded-full" style={{ backgroundColor: KIND_BG[k] }} />
                  {DAY_KIND_LABEL[k]}
                  <span className="num text-muted">{counts[k] ?? 0}</span>
                </button>
              );
            })}
            <span className="ml-auto text-xs text-muted">
              Dni zajęć: <strong className="num text-ink">{counts.school ?? 0}</strong>
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={selected ?? 'none'}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="min-h-12 rounded-xl bg-surface-2/60 px-4 py-3 text-sm"
            >
              {selected && detail ? (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <strong className="num">
                    {WEEKDAY_LONG_PL[weekdayOf(selected) - 1]}, {formatDMY(selected)}
                  </strong>
                  <Badge tone={detail.kind === 'school' ? 'brand' : 'neutral'}>
                    {DAY_KIND_LABEL[detail.kind]}
                  </Badge>
                  {detail.label && detail.label !== DAY_KIND_LABEL[detail.kind] && (
                    <span className="text-muted">{detail.label}</span>
                  )}
                </span>
              ) : (
                <span className="text-muted">Kliknij dzień, aby zobaczyć szczegóły.</span>
              )}
            </motion.div>
          </AnimatePresence>
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {calendar.months.map((m, i) => (
          <motion.div
            key={m.key}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: (i % 3) * 0.05, duration: 0.35 }}
            className="rounded-card border border-line bg-surface p-4 shadow-card"
          >
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="font-semibold tracking-tight">{m.label}</h3>
              <span className="text-xs text-muted">
                {m.teachingDays} dni zajęć · {m.workdays} roboczych
              </span>
            </div>
            <MonthGrid
              month={m}
              calendar={calendar}
              selected={selected}
              onSelect={setSelected}
              today={today}
            />
          </motion.div>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Dni wolne i wydarzenia"
          description={
            filter.size
              ? 'Przefiltrowane wg wybranych rodzajów.'
              : 'Wszystkie dni powszednie, w które nie ma zajęć lub odbywają się egzaminy.'
          }
        />
        <CardBody>
          <div className="scroll-thin max-h-[28rem] overflow-y-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-2 text-xs text-muted">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Data</th>
                  <th className="px-4 py-2.5 text-left font-medium">Dzień</th>
                  <th className="px-4 py-2.5 text-left font-medium">Rodzaj</th>
                  <th className="px-4 py-2.5 text-left font-medium">Opis</th>
                </tr>
              </thead>
              <tbody>
                {offDays.map((d) => (
                  <tr
                    key={d.date}
                    className="border-t border-line transition-colors hover:bg-surface-2/50"
                  >
                    <td className="num px-4 py-2 whitespace-nowrap">{formatDMY(d.date)}</td>
                    <td className="px-4 py-2 text-muted">
                      {WEEKDAY_LONG_PL[weekdayOf(d.date) - 1]}
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: KIND_BG[d.kind] }}
                        />
                        {DAY_KIND_LABEL[d.kind]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted">{d.label}</td>
                  </tr>
                ))}
                {offDays.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted">
                      Brak dni dla wybranego filtra.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
