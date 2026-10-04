import { eachDay, monthKeyOf, weekdayOf, type ISODate, type MonthKey } from './dates';
import { isEditableKind } from './calendar';
import { parseCell } from './cells';
import { D, Decimal, ZERO, clampNonNegative, r2, roundHours, sum } from './num';
import type {
  Calendar,
  GroupId,
  Settings,
  TeacherEvent,
  TeacherPlan,
  Timetable,
  WeekRow,
} from './types';
import type {
  CalcResult,
  DayCalc,
  ExtraLines,
  MonthResult,
  RowCalc,
  Variant1Month,
  Variant1Result,
  Variant2Month,
  Variant2Result,
} from './engine-types';

export * from './engine-types';

/* ---------------------------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------------------------- */

export function emptyTimetable(): Timetable {
  return { k12: [0, 0, 0, 0, 0], k34: [0, 0, 0, 0, 0], k5: [0, 0, 0, 0, 0], ind: [0, 0, 0, 0, 0] };
}

export function weeklyTotals(t: Timetable) {
  const total = (a: number[]) => sum(a).toNumber();
  return { k12: total(t.k12), k34: total(t.k34), k5: total(t.k5), individual: total(t.ind) };
}

/** Weekly weighted hours: Σ hours(group) × weight(group). */
export function weightedHours(
  hours: { k12: number; k34: number; k5: number; individual: number },
  weights: Settings['weights'],
  individualInPensum: boolean,
): Decimal {
  let total = D(hours.k12).times(weights.k12).plus(D(hours.k34).times(weights.k34));
  total = total.plus(D(hours.k5).times(weights.k5));
  if (individualInPensum) total = total.plus(D(hours.individual).times(weights.individual));
  return total;
}

export function effectivePensum(plan: Pick<TeacherPlan, 'contractHours' | 'pensumFull'>): number {
  const hours = plan.contractHours > 0 ? plan.contractHours : plan.pensumFull;
  return r2(hours);
}

function eventCovers(event: TeacherEvent, date: ISODate): boolean {
  return date >= event.from && date <= event.to;
}

/* ---------------------------------------------------------------------------------------------
 * Day level: what the timetable, class-5 end, events and manual edits make of a single date
 * ------------------------------------------------------------------------------------------- */

export function resolveDay(
  date: ISODate,
  kind: DayCalc['kind'],
  plan: TeacherPlan,
  settings: Settings,
): DayCalc {
  const wd = weekdayOf(date) - 1; // 0 = Monday
  const events = plan.events.filter((e) => eventCovers(e, date));
  const examExcluded = kind === 'exam' && settings.examDays === 'neutral';
  const counted = kind === 'school' || (kind === 'exam' && settings.examDays === 'normal');

  const groupHours: Record<GroupId, number> = {
    k12: plan.timetable.k12[wd] ?? 0,
    k34: plan.timetable.k34[wd] ?? 0,
    k5: plan.timetable.k5[wd] ?? 0,
  };
  const droppedGroups: GroupId[] = [];
  if (date > settings.class5EndDate && groupHours.k5 > 0) {
    groupHours.k5 = 0;
    droppedGroups.push('k5');
  }
  for (const ev of events) {
    if (ev.lessons !== 'groups') continue;
    for (const g of ev.groups) {
      if (groupHours[g] > 0) droppedGroups.push(g);
      groupHours[g] = 0;
    }
  }

  const scheduledRegular = sum([groupHours.k12, groupHours.k34, groupHours.k5]).toNumber();
  const scheduledIndividual = plan.timetable.ind[wd] ?? 0;

  let regular = D(scheduledRegular);
  let individual = D(scheduledIndividual);
  let absence = ZERO;
  const eventIds: string[] = [];

  for (const ev of events) {
    if (ev.lessons === 'none') continue;
    eventIds.push(ev.id);
    if (ev.lessons === 'partial') {
      const lost = D(ev.hoursPerDay);
      regular = clampNonNegative(regular.minus(lost));
      if (scheduledRegular > 0) {
        absence = Decimal.min(D(1), absence.plus(lost.div(scheduledRegular)));
      }
    } else if (ev.lessons === 'whole-day') {
      regular = ZERO;
      individual = ZERO;
      absence = D(1);
    }
  }

  let overridden = false;
  const manual = plan.cellOverrides[date];
  if (manual !== undefined && isEditableKind(kind)) {
    const parsed = parseCell(manual);
    if (parsed.ok) {
      regular = D(parsed.regular);
      individual = D(parsed.individual);
      overridden = true;
    }
  }

  if (settings.absenceCounting === 'lesson-days' && scheduledRegular + scheduledIndividual === 0) {
    absence = ZERO;
  }

  return {
    date,
    kind,
    counted,
    examExcluded,
    scheduledRegular,
    scheduledIndividual,
    regular: regular.toNumber(),
    individual: individual.toNumber(),
    overridden,
    eventIds,
    absence: absence.toNumber(),
    droppedGroups,
  };
}

/* ---------------------------------------------------------------------------------------------
 * Variant 2: real hours per week against an averaged pensum
 * ------------------------------------------------------------------------------------------- */

export interface AveragedPensum {
  /** Weekly threshold above which hours are overtime; `null` when the year has no surplus. */
  value: number | null;
  annualSurplus: number;
}

/**
 * Finds the weekly threshold p such that the overtime summed over all weeks
 *   Σ max(0, hours_i − p·weight_i)
 * equals the real surplus of the year, Σ hours_i − pensum·Σ weight_i.
 *
 * This is the "pensum uśrednione": the teacher first has to work off the pensum on average over the
 * whole school year (weeks with practical training or without class 5 count as shortfall), and only
 * what is above that threshold is paid. The function is convex and piecewise-linear, so it is
 * solved exactly by walking the weeks from the busiest one down (no iteration, no tolerance).
 */
export function solveAveragedPensum(
  weeks: { hours: Decimal.Value; weight: Decimal.Value }[],
  pensum: Decimal.Value,
): AveragedPensum {
  const items = weeks
    .map((w) => ({ hours: D(w.hours), weight: D(w.weight) }))
    .filter((w) => w.weight.greaterThan(0));
  const totalHours = sum(items.map((i) => i.hours));
  const totalWeight = sum(items.map((i) => i.weight));
  const surplus = totalHours.minus(D(pensum).times(totalWeight));
  if (surplus.lessThanOrEqualTo(0)) return { value: null, annualSurplus: 0 };

  const sorted = items
    .map((i) => ({ ...i, load: i.hours.div(i.weight) }))
    .sort((a, b) => b.load.comparedTo(a.load));

  let cumHours = ZERO;
  let cumWeight = ZERO;
  for (let k = 0; k < sorted.length; k += 1) {
    cumHours = cumHours.plus(sorted[k]!.hours);
    cumWeight = cumWeight.plus(sorted[k]!.weight);
    const p = cumHours.minus(surplus).div(cumWeight);
    const next = sorted[k + 1];
    if (!next || p.greaterThanOrEqualTo(next.load)) {
      return { value: p.toNumber(), annualSurplus: surplus.toNumber() };
    }
  }
  /* c8 ignore next */
  return { value: D(pensum).toNumber(), annualSurplus: surplus.toNumber() };
}

function buildRowCalcs(
  rows: WeekRow[],
  days: Record<ISODate, DayCalc>,
  individualInPensum: boolean,
): Omit<RowCalc, 'pensum' | 'pensumExact' | 'overtime'>[] {
  return rows.map((row) => {
    const cells = row.cells.map((c) => (c.date ? (days[c.date] ?? null) : null));
    let hours = ZERO;
    let ind = ZERO;
    let counted = 0;
    for (const cell of cells) {
      if (!cell || !cell.counted) continue;
      counted += 1;
      hours = hours.plus(cell.regular);
      if (individualInPensum) hours = hours.plus(cell.individual);
      else ind = ind.plus(cell.individual);
    }
    return {
      row,
      cells,
      countedDays: counted,
      weight: counted / 5,
      hours: hours.toNumber(),
      individualSeparate: ind.toNumber(),
    };
  });
}

function computeVariant2(
  calendar: Calendar,
  days: Record<ISODate, DayCalc>,
  plan: TeacherPlan,
  settings: Settings,
  pensum: number,
): Variant2Result {
  const base = buildRowCalcs(calendar.rows, days, plan.individualInPensum);
  const weeks = base.filter((r) => r.countedDays > 0);
  const annualHours = sum(weeks.map((r) => r.hours));
  const totalWeight = sum(weeks.map((r) => r.weight));
  const annualObligation = D(pensum).times(totalWeight);

  let averaged: number | null;
  let source: Variant2Result['averagedPensumSource'];
  let annualSurplus: number;
  if (plan.avgPensumOverride !== null && plan.avgPensumOverride > 0) {
    averaged = plan.avgPensumOverride;
    source = 'manual';
    annualSurplus = annualHours.minus(annualObligation).toNumber();
  } else {
    const solved = solveAveragedPensum(
      weeks.map((r) => ({ hours: r.hours, weight: r.weight })),
      pensum,
    );
    averaged = solved.value;
    source = solved.value === null ? 'none' : 'auto';
    annualSurplus = solved.annualSurplus;
  }

  const rows: RowCalc[] = base.map((r) => {
    if (r.countedDays === 0) return { ...r, pensum: 0, pensumExact: 0, overtime: 0 };
    if (averaged === null) {
      const plain = D(pensum).times(r.weight);
      return { ...r, pensum: r2(plain), pensumExact: plain.toNumber(), overtime: 0 };
    }
    const rowPensum = D(averaged).times(r.weight);
    return {
      ...r,
      pensum: r2(rowPensum),
      pensumExact: rowPensum.toNumber(),
      overtime: clampNonNegative(D(r.hours).minus(rowPensum)).toNumber(),
    };
  });

  const months: Variant2Month[] = calendar.months.map((m) => {
    const monthRows = rows.filter((r) => r.row.monthKey === m.key);
    // Use unrounded row overtime for the monthly sum
    const raw = sum(
      monthRows.map((r) => {
        if (averaged === null || r.countedDays === 0) return ZERO;
        return clampNonNegative(D(r.hours).minus(D(averaged).times(r.weight)));
      }),
    );
    return {
      monthKey: m.key,
      label: m.label,
      rows: monthRows,
      hours: sum(monthRows.map((r) => r.hours)).toNumber(),
      pensum: r2(
        sum(
          monthRows.map((r) =>
            averaged === null ? D(pensum).times(r.weight) : D(averaged).times(r.weight),
          ),
        ),
      ),
      overtimeRaw: r2(raw),
      overtime: roundHours(raw, settings.rounding),
    };
  });

  return {
    averagedPensum: averaged === null ? null : r2(averaged),
    averagedPensumSource: source,
    annualHours: annualHours.toNumber(),
    annualObligation: r2(annualObligation),
    annualSurplus: r2(annualSurplus),
    weeks: r2(totalWeight),
    months,
    rows,
    total: months.reduce((acc, m) => acc + m.overtime, 0),
  };
}

/* ---------------------------------------------------------------------------------------------
 * Variant 1: averaged (weighted) weekly hours
 * ------------------------------------------------------------------------------------------- */

/** Core of variant 1, kept separate so it can be tested against the worked example. */
export function variant1Core(
  weighted: Decimal.Value,
  pensum: Decimal.Value,
  weeksPerMonth: Decimal.Value,
) {
  const weeklyDiff = D(weighted).minus(pensum);
  const weeklyOvertime = clampNonNegative(weeklyDiff);
  const monthlyRaw = weeklyOvertime.times(weeksPerMonth);
  return {
    weeklyOvertime: weeklyOvertime.toNumber(),
    weeklyShortfall: weeklyDiff.isNegative() ? weeklyDiff.abs().toNumber() : 0,
    monthlyRaw: monthlyRaw.toNumber(),
  };
}

/** Monthly deduction for absence: (monthly overtime ÷ working days) × absent days, rounded. */
export function variant1Deduction(
  monthlyOvertime: Decimal.Value,
  workdays: number,
  absenceDays: Decimal.Value,
  rounding: Settings['rounding'],
) {
  if (workdays <= 0) return { perDay: 0, deductionRaw: 0, deduction: 0 };
  const perDay = D(monthlyOvertime).div(workdays);
  const raw = perDay.times(absenceDays);
  return {
    perDay: perDay.toNumber(),
    deductionRaw: raw.toNumber(),
    deduction: roundHours(raw, rounding),
  };
}

function computeVariant1(
  calendar: Calendar,
  days: Record<ISODate, DayCalc>,
  plan: TeacherPlan,
  settings: Settings,
  pensum: number,
): Variant1Result {
  const hours = weeklyTotals(plan.timetable);
  const weighted = weightedHours(hours, settings.weights, plan.individualInPensum);
  const core = variant1Core(weighted, pensum, settings.weeksPerMonth);
  const monthlyRounded = roundHours(core.monthlyRaw, settings.rounding);

  const months: Variant1Month[] = calendar.months.map((m) => {
    const auto = sum(
      eachDay(m.firstDate, m.lastDate).map((d) => {
        const dc = days[d];
        return dc && dc.kind === 'school' ? dc.absence : 0;
      }),
    ).toNumber();
    const manual = plan.monthly[m.key]?.absenceDays;
    const absenceDays = manual !== undefined ? manual : auto;
    const denominator = settings.workdaysBasis === 'school-days' ? m.teachingDays : m.workdays;
    const ded = variant1Deduction(monthlyRounded, denominator, absenceDays, settings.rounding);
    return {
      monthKey: m.key,
      label: m.label,
      workdays: denominator,
      absenceDaysAuto: r2(auto),
      absenceDays: r2(absenceDays),
      perDay: r2(ded.perDay),
      deductionRaw: r2(ded.deductionRaw),
      deduction: ded.deduction,
      monthlyOvertime: monthlyRounded,
      overtime: Math.max(0, monthlyRounded - ded.deduction),
    };
  });

  return {
    hours,
    weightedHours: r2(weighted),
    pensum,
    weeklyOvertime: r2(core.weeklyOvertime),
    weeklyShortfall: r2(core.weeklyShortfall),
    monthlyRaw: r2(core.monthlyRaw),
    monthlyRounded,
    months,
    total: months.reduce((acc, m) => acc + m.overtime, 0),
  };
}

/* ---------------------------------------------------------------------------------------------
 * Separately settled hours (substitutions, individual teaching, trips, exams …)
 * ------------------------------------------------------------------------------------------- */

function computeExtras(
  calendar: Calendar,
  days: Record<ISODate, DayCalc>,
  plan: TeacherPlan,
): Record<MonthKey, ExtraLines> {
  const out: Record<MonthKey, ExtraLines> = {};
  for (const m of calendar.months) {
    out[m.key] = { substitutions: 0, individual: 0, trips: 0, exams: 0, other: 0, free: 0 };
  }

  for (const m of calendar.months) {
    const line = out[m.key]!;
    const adj = plan.monthly[m.key];
    if (!plan.individualInPensum) {
      const auto = sum(
        eachDay(m.firstDate, m.lastDate).map((d) => {
          const dc = days[d];
          return dc && dc.counted ? dc.individual : 0;
        }),
      ).toNumber();
      line.individual = adj?.individual !== undefined ? adj.individual : auto;
    }
    if (adj?.substitutions !== undefined) line.substitutions += adj.substitutions;
  }

  for (const ev of plan.events) {
    const line = out[monthKeyOf(ev.from)];
    if (!line) continue;
    if (ev.settlement === 'free') {
      line.free += ev.paidHours;
      continue;
    }
    if (ev.settlement !== 'separate') continue;
    switch (ev.kind) {
      case 'substitution':
        line.substitutions += ev.paidHours;
        break;
      case 'individual':
        line.individual += ev.paidHours;
        break;
      case 'trip':
        line.trips += ev.paidHours;
        break;
      case 'exam-oral':
      case 'exam-assist':
        line.exams += ev.paidHours;
        break;
      default:
        line.other += ev.paidHours;
    }
  }

  for (const line of Object.values(out)) {
    for (const key of Object.keys(line) as (keyof ExtraLines)[]) line[key] = r2(line[key]);
  }
  return out;
}

export function extrasTotal(line: ExtraLines): number {
  return r2(line.substitutions + line.individual + line.trips + line.exams + line.other);
}

/* ---------------------------------------------------------------------------------------------
 * Public entry point
 * ------------------------------------------------------------------------------------------- */

export function calculate(plan: TeacherPlan, settings: Settings, calendar: Calendar): CalcResult {
  const pensum = effectivePensum(plan);

  const days: Record<ISODate, DayCalc> = {};
  for (const row of calendar.rows) {
    for (const cell of row.cells) {
      if (!cell.date || cell.kind === 'void') continue;
      days[cell.date] = resolveDay(cell.date, cell.kind, plan, settings);
    }
  }

  const v1 = computeVariant1(calendar, days, plan, settings, pensum);
  const v2 = computeVariant2(calendar, days, plan, settings, pensum);
  const extras = computeExtras(calendar, days, plan);

  const months: MonthResult[] = calendar.months.map((m, i) => ({
    monthKey: m.key,
    label: m.label,
    v1: v1.months[i]!,
    v2: v2.months[i]!,
    extras: extras[m.key]!,
  }));

  const overtimeTotal = plan.variant === 1 ? v1.total : v2.total;
  const extrasSum = months.reduce((acc, m) => acc + extrasTotal(m.extras), 0);

  return {
    pensum,
    days,
    v1,
    v2,
    months,
    selected: {
      variant: plan.variant,
      overtimeTotal,
      extrasTotal: r2(extrasSum),
      grandTotal: r2(overtimeTotal + extrasSum),
    },
  };
}
