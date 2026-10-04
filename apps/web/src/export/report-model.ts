import {
  DAY_KIND_LABEL,
  EVENT_KIND_META,
  WEEKDAY_SHORT_PL,
  formatCell,
  formatDMY,
  type CalcResult,
  type Calendar,
  type DayKind,
  type Settings,
  type TeacherPlan,
} from '@nadgodziny/core';
import { fmt, fmt2, fmtPln } from '../lib/format';

export type ReportCellKind = 'school' | 'off' | 'exam' | 'void';

export interface ReportCell {
  /** Regular part, e.g. "3" */
  regular: string;
  /** Individual-teaching part (printed green), e.g. "1" */
  individual: string;
  kind: ReportCellKind;
  excluded: boolean;
}

export interface ReportRow {
  label: string;
  cells: ReportCell[];
  hours: string;
  pensum: string;
  overtime: string;
  dead: boolean;
}

export interface ReportMonthBlock {
  key: string;
  label: string;
  rows: ReportRow[];
  hours: string;
  pensum: string;
  overtimeRaw: string;
  payable: string;
}

export interface MonthlyLine {
  label: string;
  cells: string[];
}

export interface Report {
  title: string;
  heading: string;
  schoolName: string;
  schoolYear: string;
  teacherName: string;
  variantLabel: string;
  variant: 1 | 2;
  generatedAt: string;
  facts: { label: string; value: string }[];
  v1Steps: { label: string; math: string; result: string }[];
  weekdays: readonly string[];
  weeklyMonths: ReportMonthBlock[];
  monthlyHeader: string[];
  monthlyLines: MonthlyLine[];
  monthlyTotal: string[];
  events: { title: string; range: string; effect: string; settlement: string }[];
  notes: string[];
  total: { overtime: number; extras: number; text: string };
  fileBaseName: string;
}

const KIND_TO_REPORT: Record<DayKind | 'void', ReportCellKind> = {
  school: 'school',
  exam: 'exam',
  void: 'void',
  weekend: 'off',
  outside: 'off',
  holiday: 'off',
  break: 'off',
  ferie: 'off',
  den: 'off',
  director: 'off',
  other: 'off',
};

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildReport(
  plan: TeacherPlan,
  settings: Settings,
  calendar: Calendar,
  result: CalcResult,
  now: Date = new Date(),
): Report {
  const { v1, v2 } = result;
  const schoolYear = calendar.label;

  const weeklyMonths: ReportMonthBlock[] = v2.months.map((m) => ({
    key: m.monthKey,
    label: m.label,
    hours: fmt(m.hours),
    pensum: fmt2(m.pensum),
    overtimeRaw: fmt2(m.overtimeRaw),
    payable: String(m.overtime),
    rows: m.rows.map((rc) => ({
      label: rc.row.label,
      dead: rc.countedDays === 0,
      hours: rc.countedDays === 0 ? '' : fmt(rc.hours),
      pensum: rc.countedDays === 0 ? '' : fmt2(rc.pensum),
      overtime: rc.countedDays === 0 ? '' : fmt2(rc.overtime),
      cells: rc.row.cells.map((cell, i): ReportCell => {
        const day = rc.cells[i] ?? null;
        const kind = KIND_TO_REPORT[cell.kind];
        if (!day || kind !== 'school') {
          if (kind === 'exam' && day) {
            return {
              regular: day.regular ? fmt(day.regular) : '',
              individual: day.individual ? fmt(day.individual) : '',
              kind,
              excluded: true,
            };
          }
          return { regular: '', individual: '', kind, excluded: false };
        }
        return {
          regular: day.regular ? fmt(day.regular) : day.individual ? '0' : '',
          individual: day.individual ? fmt(day.individual) : '',
          kind,
          excluded: false,
        };
      }),
    })),
  }));

  const monthlyHeader = [
    'Miesiąc',
    plan.variant === 1 ? 'Nadgodziny' : 'Nadgodziny (tyg.)',
    'Zastępstwa',
    'Indywidualne',
    'Wycieczki',
    'Egzaminy',
    'Inne',
    'Razem',
  ];

  const sumExtras = { sub: 0, ind: 0, trips: 0, exams: 0, other: 0, total: 0 };
  const monthlyLines: MonthlyLine[] = result.months.map((m) => {
    const overtime = plan.variant === 1 ? m.v1.overtime : m.v2.overtime;
    const e = m.extras;
    const total = overtime + e.substitutions + e.individual + e.trips + e.exams + e.other;
    sumExtras.sub += e.substitutions;
    sumExtras.ind += e.individual;
    sumExtras.trips += e.trips;
    sumExtras.exams += e.exams;
    sumExtras.other += e.other;
    sumExtras.total += total;
    const f = (n: number) => (n ? fmt(n) : '—');
    return {
      label: m.label,
      cells: [
        f(overtime),
        f(e.substitutions),
        f(e.individual),
        f(e.trips),
        f(e.exams),
        f(e.other),
        fmt(total),
      ],
    };
  });
  const monthlyTotal = [
    fmt(result.selected.overtimeTotal),
    fmt(sumExtras.sub),
    fmt(sumExtras.ind),
    fmt(sumExtras.trips),
    fmt(sumExtras.exams),
    fmt(sumExtras.other),
    fmt(sumExtras.total),
  ];

  const w = settings.weights;
  const terms = [
    v1.hours.k12 > 0 && `${fmt(v1.hours.k12)}×${fmt(w.k12)}`,
    v1.hours.k34 > 0 && `${fmt(v1.hours.k34)}×${fmt(w.k34)}`,
    v1.hours.k5 > 0 && `${fmt(v1.hours.k5)}×${fmt(w.k5)}`,
  ].filter(Boolean);
  const v1Steps = [
    {
      label: 'Godziny ważone (nauczycielskie)',
      math: terms.join(' + ') || '—',
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
    },
  ];

  const facts: { label: string; value: string }[] = [
    { label: 'Wymiar zatrudnienia', value: `${fmt(result.pensum)} godz./tydz.` },
    {
      label: 'Przydział tygodniowo',
      value: `kl. 1–2: ${fmt(v1.hours.k12)} · kl. 3–4: ${fmt(v1.hours.k34)} · kl. 5: ${fmt(v1.hours.k5)} · indyw.: ${fmt(v1.hours.individual)}`,
    },
  ];
  if (plan.variant === 1) {
    facts.push({ label: 'Godziny ważone', value: fmt2(v1.weightedHours) });
    facts.push({
      label: 'Nadgodziny miesięcznie (uśrednione)',
      value: `${v1.monthlyRounded} godz.`,
    });
  } else {
    facts.push({
      label: 'Pensum uśrednione',
      value: v2.averagedPensum === null ? '—' : `${fmt2(v2.averagedPensum)} godz./tydz.`,
    });
    facts.push({
      label: 'Godziny w roku / obowiązek',
      value: `${fmt(v2.annualHours)} / ${fmt(v2.annualObligation)} godz.`,
    });
  }
  facts.push({
    label: 'Nadgodziny w roku szkolnym',
    value: `${result.selected.overtimeTotal} godz.`,
  });
  if (result.selected.extrasTotal > 0) {
    facts.push({
      label: 'Rozliczane odrębnie',
      value: `${fmt(result.selected.extrasTotal)} godz.`,
    });
  }
  if (plan.hourlyRate) {
    facts.push({
      label: 'Szacunek brutto',
      value: fmtPln(result.selected.grandTotal * plan.hourlyRate),
    });
  }

  const effectOf = (e: TeacherPlan['events'][number]): string => {
    switch (e.lessons) {
      case 'whole-day':
        return 'zajęcia nie odbywają się (cały dzień)';
      case 'partial':
        return `odpada ${fmt(e.hoursPerDay)} godz. dziennie`;
      case 'groups':
        return 'brak zajęć w wybranych klasach';
      default:
        return 'bez wpływu na zajęcia';
    }
  };
  const settlementOf = (e: TeacherPlan['events'][number]): string =>
    e.settlement === 'separate'
      ? `rozliczane odrębnie${e.paidHours ? ` (${fmt(e.paidHours)} godz.)` : ''}`
      : e.settlement === 'free'
        ? `w okienku, niepłatne${e.paidHours ? ` (${fmt(e.paidHours)} godz.)` : ''}`
        : 'zwykłe rozliczenie';

  const events = [...plan.events]
    .sort((a, b) => a.from.localeCompare(b.from))
    .map((e) => ({
      title: `${e.title} — ${EVENT_KIND_META[e.kind].label.toLowerCase()}`,
      range: e.from === e.to ? formatDMY(e.from) : `${formatDMY(e.from)} – ${formatDMY(e.to)}`,
      effect: effectOf(e),
      settlement: settlementOf(e),
    }));

  const notes = [
    'Harmonogram praktyk uczniowskich znajduje się w pokoju nauczycielskim — godziny w okresie trwania praktyk należy ODJĄĆ w tygodniowym rozkładzie.',
    `Zajęcia w klasach 5-tych trwają do ${formatDMY(settings.class5EndDate)} r., włącznie. Należy je ODJĄĆ w maju i czerwcu.`,
    'W dni przeznaczone na egzaminy nadgodziny nie są płacone — udział w egzaminach to obowiązek dodatkowy w ramach podstawowego wynagrodzenia, z wyłączeniem egzaminów ustnych i funkcji asystenta/operatora, które są rozliczane odrębnie.',
    'Godziny nauczania indywidualnego zapisane są kolorem zielonym, np. 3+1 (3 godz. przedmiotu i 1 godz. indywidualna).',
    'Księgowość rozlicza PEŁNE miesiące.',
  ];

  const variantLabel =
    plan.variant === 1 ? 'Wariant 1 — uśredniony' : 'Wariant 2 — według realnego przydziału';
  const name = plan.teacherName.trim();
  const stamp = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;

  return {
    title: `Tabela rozliczenia godzin zajęć dydaktycznych w roku szkolnym ${schoolYear}`,
    heading: `Tabela rozliczenia godzin zajęć dydaktycznych w roku szkolnym ${schoolYear}`,
    schoolName: settings.schoolName,
    schoolYear,
    teacherName: name,
    variantLabel,
    variant: plan.variant,
    generatedAt: stamp,
    facts,
    v1Steps,
    weekdays: WEEKDAY_SHORT_PL,
    weeklyMonths,
    monthlyHeader,
    monthlyLines,
    monthlyTotal,
    events,
    notes,
    total: {
      overtime: result.selected.overtimeTotal,
      extras: result.selected.extrasTotal,
      text: `${result.selected.overtimeTotal} godz.`,
    },
    fileBaseName: ['nadgodziny', slug(name) || 'nauczyciel', schoolYear.replace('/', '-')].join(
      '-',
    ),
  };
}

export { formatCell, DAY_KIND_LABEL };
