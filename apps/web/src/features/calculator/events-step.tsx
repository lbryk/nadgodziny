import { zodResolver } from '@hookform/resolvers/zod';
import {
  EVENT_KIND_META,
  calculate,
  createEvent,
  formatDMY,
  type EventKind,
  type GroupId,
  type TeacherEvent,
} from '@nadgodziny/core';
import {
  Bus,
  CalendarPlus,
  ClipboardCheck,
  GraduationCap,
  Hammer,
  Mic,
  Pencil,
  Sparkles,
  Stethoscope,
  Trash2,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardBody, CardHeader } from '../../components/ui/card';
import { Field, Input, NumberField, inputClass } from '../../components/ui/field';
import { Segmented } from '../../components/ui/segmented';
import { useCalc } from '../../hooks/calc-context';
import { cn } from '../../lib/cn';
import { fmt } from '../../lib/format';
import { usePlanStore } from '../../state/plan-store';
import { GROUP_LABEL } from './groups';

const KIND_ICON: Record<EventKind, LucideIcon> = {
  trip: Bus,
  training: GraduationCap,
  absence: Stethoscope,
  practice: Hammer,
  'exam-oral': Mic,
  'exam-assist': ClipboardCheck,
  substitution: Users,
  individual: UserRound,
  other: Sparkles,
};

const KIND_ORDER: EventKind[] = [
  'trip',
  'training',
  'absence',
  'practice',
  'exam-oral',
  'exam-assist',
  'substitution',
  'individual',
  'other',
];

const schema = z
  .object({
    kind: z.enum(KIND_ORDER as [EventKind, ...EventKind[]]),
    title: z.string().trim().min(1, 'Podaj nazwę wydarzenia.').max(160),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Wybierz datę.'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Wybierz datę.'),
    lessons: z.enum(['none', 'whole-day', 'partial', 'groups']),
    hoursPerDay: z.number().min(0).max(12),
    groups: z.array(z.enum(['k12', 'k34', 'k5'])),
    settlement: z.enum(['none', 'separate', 'free']),
    paidHours: z.number().min(0).max(400),
    note: z.string().max(600),
  })
  .superRefine((v, ctx) => {
    if (v.to < v.from)
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'Data końcowa jest przed początkową.',
      });
    if (v.lessons === 'partial' && v.hoursPerDay <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['hoursPerDay'],
        message: 'Podaj, ile godzin dziennie się nie odbywa.',
      });
    }
    if (v.lessons === 'groups' && v.groups.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['groups'],
        message: 'Wybierz przynajmniej jedną grupę klas.',
      });
    }
  });

type FormValues = z.infer<typeof schema>;

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toValues(e: TeacherEvent): FormValues {
  const { id: _id, ...rest } = e;
  void _id;
  return rest;
}

export default function EventsStep() {
  const { plan, settings, calendar } = useCalc();
  const { addEvent, updateEvent, removeEvent } = usePlanStore();
  const [editing, setEditing] = useState<string | null>(null);

  const minDate = `${settings.schoolYearStart}-09-01`;
  const maxDate = `${settings.schoolYearStart + 1}-06-30`;
  const initialDate = useMemo(() => {
    const t = localToday();
    return t >= minDate && t <= maxDate ? t : calendar.startDate;
  }, [calendar.startDate, minDate, maxDate]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toValues(createEvent('new', 'trip', initialDate)),
    mode: 'onChange',
  });
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = form;
  const values = watch();

  // Live effect of the event on both variants (replaces the edited event when editing).
  const preview = useMemo(() => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) return null;
    const others = plan.events.filter((e) => e.id !== editing);
    const ev: TeacherEvent = { ...parsed.data, id: 'preview' };
    const without = calculate({ ...plan, events: others }, settings, calendar);
    const withEv = calculate({ ...plan, events: [...others, ev] }, settings, calendar);
    let lost = 0;
    let absence = 0;
    for (const [date, d] of Object.entries(withEv.days)) {
      if (date < ev.from || date > ev.to) continue;
      const before = without.days[date];
      if (before) lost += before.regular + before.individual - d.regular - d.individual;
      if (d.kind === 'school') absence += d.absence;
    }
    return {
      v1: withEv.v1.total - without.v1.total,
      v2: withEv.v2.total - without.v2.total,
      lost,
      absence,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values), plan, settings, calendar, editing]);

  useEffect(() => {
    if (editing && !plan.events.some((e) => e.id === editing)) setEditing(null);
  }, [plan.events, editing]);

  const pickKind = (kind: EventKind) => {
    const fresh = createEvent('x', kind, values.from || initialDate);
    const keepTitle =
      values.title && !KIND_ORDER.some((k) => EVENT_KIND_META[k].label === values.title);
    setValue('kind', kind);
    setValue('title', keepTitle ? values.title : fresh.title, { shouldValidate: true });
    setValue('lessons', fresh.lessons);
    setValue('settlement', fresh.settlement);
    setValue('groups', fresh.groups);
  };

  const submit = handleSubmit((data) => {
    if (editing) {
      updateEvent(editing, data);
      toast.success('Zapisano zmiany w wydarzeniu.');
    } else {
      addEvent({ ...data, id: crypto.randomUUID() });
      toast.success('Dodano wydarzenie — wynik został przeliczony.');
    }
    setEditing(null);
    reset(toValues(createEvent('new', data.kind, data.from)));
  });

  const startEdit = (e: TeacherEvent) => {
    setEditing(e.id);
    reset(toValues(e));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sorted = [...plan.events].sort((a, b) => a.from.localeCompare(b.from));
  const showHours = values.lessons === 'partial';
  const showGroups = values.lessons === 'groups';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <CardHeader
          icon={<CalendarPlus className="size-5" />}
          title={editing ? 'Edytuj wydarzenie' : 'Dodaj wydarzenie'}
          description="Wycieczki, szkolenia, praktyki, zastępstwa — wszystko, co zmienia Twój przydział. Dyrektor nie płaci podwójnie za tę samą godzinę."
          actions={
            editing && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  reset(toValues(createEvent('new', 'trip', initialDate)));
                }}
              >
                <X className="size-3.5" /> Anuluj edycję
              </Button>
            )
          }
        />
        <CardBody>
          <form onSubmit={submit} className="space-y-5" noValidate>
            <div
              role="radiogroup"
              aria-label="Rodzaj wydarzenia"
              className="grid grid-cols-3 gap-2 sm:grid-cols-5"
            >
              {KIND_ORDER.map((k) => {
                const Icon = KIND_ICON[k];
                const active = values.kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => pickKind(k)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center text-[11px] leading-tight font-medium transition-all',
                      active
                        ? 'border-brand bg-brand-soft text-brand ring-4 ring-brand/10'
                        : 'border-line text-muted hover:border-brand/40 hover:text-ink',
                    )}
                  >
                    <Icon className="size-5" />
                    {EVENT_KIND_META[k].label}
                  </button>
                );
              })}
            </div>
            <p className="rounded-xl bg-surface-2/70 px-3 py-2 text-[13px] text-muted">
              {EVENT_KIND_META[values.kind].hint}
            </p>

            <Field label="Nazwa" error={errors.title?.message}>
              {(id) => <Input id={id} {...register('title')} maxLength={160} />}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Od" error={errors.from?.message}>
                {(id) => (
                  <input
                    id={id}
                    type="date"
                    min={minDate}
                    max={maxDate}
                    className={inputClass}
                    {...register('from')}
                  />
                )}
              </Field>
              <Field label="Do" error={errors.to?.message}>
                {(id) => (
                  <input
                    id={id}
                    type="date"
                    min={values.from || minDate}
                    max={maxDate}
                    className={inputClass}
                    {...register('to')}
                  />
                )}
              </Field>
            </div>

            <div className="space-y-2">
              <span className="text-[13px] font-medium">Wpływ na zajęcia z przydziału</span>
              <Controller
                control={control}
                name="lessons"
                render={({ field }) => (
                  <Segmented
                    aria-label="Wpływ na zajęcia"
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: 'none', label: 'Bez wpływu' },
                      { value: 'whole-day', label: 'Cały dzień' },
                      { value: 'partial', label: 'Część zajęć' },
                      { value: 'groups', label: 'Wybrane klasy' },
                    ]}
                  />
                )}
              />
              <AnimatePresence initial={false}>
                {showHours && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <Field
                      label="Godzin dziennie, które się nie odbywają"
                      error={errors.hoursPerDay?.message}
                      className="max-w-xs pt-1"
                    >
                      {(id) => (
                        <Controller
                          control={control}
                          name="hoursPerDay"
                          render={({ field }) => (
                            <NumberField
                              id={id}
                              value={field.value}
                              onChange={field.onChange}
                              min={0}
                              max={12}
                              step={0.5}
                              suffix="godz."
                            />
                          )}
                        />
                      )}
                    </Field>
                  </motion.div>
                )}
                {showGroups && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <Controller
                      control={control}
                      name="groups"
                      render={({ field }) => (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {(['k12', 'k34', 'k5'] as GroupId[]).map((g) => {
                            const on = field.value.includes(g);
                            return (
                              <label
                                key={g}
                                className={cn(
                                  'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm',
                                  on
                                    ? 'border-brand bg-brand-soft text-brand'
                                    : 'border-line text-muted',
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="accent-[var(--brand)]"
                                  checked={on}
                                  onChange={() =>
                                    field.onChange(
                                      on ? field.value.filter((x) => x !== g) : [...field.value, g],
                                    )
                                  }
                                />
                                {GROUP_LABEL[g]}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    />
                    {errors.groups?.message && (
                      <p className="pt-1 text-xs text-danger">{errors.groups.message}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-2">
              <span className="text-[13px] font-medium">Rozliczenie</span>
              <Controller
                control={control}
                name="settlement"
                render={({ field }) => (
                  <Segmented
                    aria-label="Rozliczenie"
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: 'none', label: 'Zwykłe' },
                      { value: 'separate', label: 'Odrębnie (płatne)' },
                      { value: 'free', label: 'W okienku (niepłatne)' },
                    ]}
                  />
                )}
              />
              {values.settlement !== 'none' && (
                <Field
                  label={
                    values.settlement === 'separate'
                      ? 'Godziny do wypłaty'
                      : 'Godziny wykonane w ramach 40 h tygodnia'
                  }
                  hint={
                    values.settlement === 'free'
                      ? 'Zastępstwo w czasie okienka nie jest płatne, jeśli zastępowany nauczyciel jest na wycieczce.'
                      : 'Doliczane w miesiącu rozpoczęcia wydarzenia, osobno od nadgodzin.'
                  }
                  className="max-w-xs pt-1"
                  error={errors.paidHours?.message}
                >
                  {(id) => (
                    <Controller
                      control={control}
                      name="paidHours"
                      render={({ field }) => (
                        <NumberField
                          id={id}
                          value={field.value}
                          onChange={field.onChange}
                          min={0}
                          max={400}
                          step={0.5}
                          suffix="godz."
                        />
                      )}
                    />
                  )}
                </Field>
              )}
            </div>

            <Field label="Notatka (opcjonalnie)">
              {(id) => (
                <textarea
                  id={id}
                  rows={2}
                  maxLength={600}
                  className={cn(inputClass, 'h-auto py-2')}
                  {...register('note')}
                />
              )}
            </Field>

            <AnimatePresence initial={false}>
              {preview && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-brand/25 bg-brand-soft p-4 text-sm"
                >
                  <p className="font-medium">Wpływ na wynik</p>
                  <ul className="mt-1.5 grid gap-x-6 gap-y-1 text-[13px] text-muted sm:grid-cols-2">
                    <li>
                      Wariant 1: <Delta value={preview.v1} />{' '}
                      {preview.absence > 0 && (
                        <span>({fmt(preview.absence)} dnia nieobecności)</span>
                      )}
                    </li>
                    <li>
                      Wariant 2: <Delta value={preview.v2} />
                    </li>
                    <li className="sm:col-span-2">
                      Zajęcia, które odpadają:{' '}
                      <strong className="text-ink">{fmt(preview.lost)} godz.</strong>
                    </li>
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-end">
              <Button type="submit" variant="primary">
                {editing ? 'Zapisz zmiany' : 'Dodaj wydarzenie'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="self-start"
      >
        <CardHeader
          title={`Twoje wydarzenia${sorted.length ? ` (${sorted.length})` : ''}`}
          description="Wpływają na wynik w obu wariantach i trafiają na wydruk."
        />
        <CardBody>
          {sorted.length === 0 ? (
            <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-line py-10 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted">
                <CalendarPlus className="size-6" />
              </div>
              <p className="max-w-60 text-sm text-muted">
                Nie dodano jeszcze żadnych wydarzeń. Zacznij od wycieczki albo praktyk.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              <AnimatePresence initial={false}>
                {sorted.map((e) => {
                  const Icon = KIND_ICON[e.kind];
                  const range =
                    e.from === e.to
                      ? formatDMY(e.from)
                      : `${formatDMY(e.from)} – ${formatDMY(e.to)}`;
                  return (
                    <motion.li
                      key={e.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94, height: 0 }}
                      className={cn(
                        'group flex gap-3 rounded-2xl border bg-surface-2/50 p-3.5',
                        editing === e.id ? 'border-brand' : 'border-line',
                      )}
                    >
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{e.title}</p>
                        <p className="num text-xs text-muted">{range}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {e.lessons === 'whole-day' && <Badge tone="warn">cały dzień</Badge>}
                          {e.lessons === 'partial' && (
                            <Badge tone="warn">−{fmt(e.hoursPerDay)} godz./dzień</Badge>
                          )}
                          {e.lessons === 'groups' && (
                            <Badge tone="warn">
                              {e.groups.map((g) => GROUP_LABEL[g]).join(', ')}
                            </Badge>
                          )}
                          {e.settlement === 'separate' && (
                            <Badge tone="ok">
                              odrębnie{e.paidHours > 0 ? ` · ${fmt(e.paidHours)} godz.` : ''}
                            </Badge>
                          )}
                          {e.settlement === 'free' && (
                            <Badge>
                              w okienku{e.paidHours > 0 ? ` · ${fmt(e.paidHours)} godz.` : ''}
                            </Badge>
                          )}
                        </div>
                        {e.note && <p className="mt-1.5 text-xs text-muted">{e.note}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label="Edytuj"
                          onClick={() => startEdit(e)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 hover:text-danger"
                          aria-label="Usuń"
                          onClick={() => {
                            removeEvent(e.id);
                            toast('Usunięto wydarzenie.');
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Delta({ value }: { value: number }) {
  if (value === 0) return <strong className="text-ink">bez zmian</strong>;
  return (
    <strong className={value < 0 ? 'text-danger' : 'text-ok'}>
      {value > 0 ? '+' : '−'}
      {fmt(Math.abs(value))} godz.
    </strong>
  );
}
