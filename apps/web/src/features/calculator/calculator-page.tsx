import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Bell, CalendarClock, CalendarRange, Clock, FileCheck2, ListChecks, UserRound } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Spinner } from '../../components/ui/spinner';
import { useCalc } from '../../hooks/calc-context';
import { cn } from '../../lib/cn';
import { ProfileStep } from './profile-step';
import { ResultCard } from './result-card';
import { TimetableStep } from './timetable-step';

const WeeklyTableStep = lazy(() => import('./weekly-table-step'));
const EventsStep = lazy(() => import('./events-step'));
const ResultStep = lazy(() => import('./result-step'));

const STEPS = [
  { id: 'dane', label: 'Dane', icon: UserRound },
  { id: 'przydzial', label: 'Przydział', icon: CalendarClock },
  { id: 'tabela', label: 'Tabela tygodniowa', icon: CalendarRange },
  { id: 'wydarzenia', label: 'Wydarzenia', icon: ListChecks },
  { id: 'wynik', label: 'Wynik', icon: FileCheck2 },
] as const;

type StepId = (typeof STEPS)[number]['id'];

function DeadlineBanner() {
  const { settings } = useCalc();
  const { announcement, submissionDeadline } = settings;
  if (!announcement && !submissionDeadline) return null;

  let deadlineText: string | null = null;
  let tone: 'ok' | 'warn' | 'late' = 'ok';
  if (submissionDeadline) {
    const date = parseISO(submissionDeadline);
    if (!Number.isNaN(date.getTime())) {
      const days = differenceInCalendarDays(date, new Date());
      tone = days < 0 ? 'late' : days <= 3 ? 'warn' : 'ok';
      const when = format(date, "d MMMM yyyy 'o' HH:mm", { locale: pl });
      deadlineText =
        days < 0
          ? `Termin oddania tabeli minął (${when}).`
          : days === 0
            ? `Termin oddania tabeli: dziś, ${when}.`
            : `Termin oddania tabeli: ${when} — za ${days} ${days === 1 ? 'dzień' : 'dni'}.`;
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-line bg-surface/80 px-4 py-3 text-sm backdrop-blur"
    >
      {announcement && (
        <span className="flex items-center gap-2">
          <Bell className="size-4 text-brand" /> {announcement}
        </span>
      )}
      {deadlineText && (
        <span
          className={cn(
            'flex items-center gap-2 font-medium',
            tone === 'late' ? 'text-danger' : tone === 'warn' ? 'text-warn' : 'text-ink',
          )}
        >
          <Clock className="size-4" /> {deadlineText}
        </span>
      )}
    </motion.div>
  );
}

export default function CalculatorPage() {
  const [params, setParams] = useSearchParams();
  const current = (STEPS.find((s) => s.id === params.get('krok'))?.id ?? 'dane') as StepId;
  const go = (id: StepId) => setParams(id === 'dane' ? {} : { krok: id }, { replace: true });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Kalkulator nadgodzin <span className="text-brand">nauczyciela</span>
        </h1>
        <p className="max-w-3xl text-muted">
          Uzupełnij przydział, a system sam przeliczy nadgodziny według zasad dyrektora — w obu wariantach, z
          uwzględnieniem kalendarza roku szkolnego, wycieczek i innych wydarzeń.
        </p>
      </div>

      <DeadlineBanner />

      <LayoutGroup id="steps">
        <nav
          aria-label="Kroki kalkulatora"
          className="scroll-thin -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
        >
          {STEPS.map(({ id, label, icon: Icon }, i) => {
            const active = id === current;
            return (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                  active ? 'text-ink' : 'text-muted hover:text-ink',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="step-pill"
                    className="absolute inset-0 rounded-xl bg-surface shadow-card ring-1 ring-line"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  />
                )}
                <span
                  className={cn(
                    'relative z-10 grid size-6 place-items-center rounded-full text-[11px]',
                    active ? 'bg-brand text-white dark:text-[#0b0e1a]' : 'bg-surface-2',
                  )}
                >
                  {i + 1}
                </span>
                <Icon className="relative z-10 hidden size-4 md:block" />
                <span className="relative z-10 whitespace-nowrap">{label}</span>
              </button>
            );
          })}
        </nav>
      </LayoutGroup>

      <div className={cn('grid items-start gap-6', current !== 'wynik' && 'xl:grid-cols-[minmax(0,1fr)_360px]')}>
        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense
                fallback={
                  <div className="grid h-48 place-items-center">
                    <Spinner className="size-6" />
                  </div>
                }
              >
                {current === 'dane' && <ProfileStep />}
                {current === 'przydzial' && <TimetableStep />}
                {current === 'tabela' && <WeeklyTableStep />}
                {current === 'wydarzenia' && <EventsStep />}
                {current === 'wynik' && <ResultStep />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
        {current !== 'wynik' && (
          <aside className="xl:sticky xl:top-24">
            <ResultCard onOpenResult={() => go('wynik')} />
          </aside>
        )}
      </div>
    </div>
  );
}
