import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_SETTINGS,
  VOIVODESHIPS,
  buildCalendar,
  calculate,
  createDefaultPlan,
  emptyTimetable,
  feriePreset,
  formatDMY,
  settingsSchema,
  type Settings,
} from '@nadgodziny/core';
import { Calculator, Percent, RotateCcw, Save, School, SlidersHorizontal, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Callout } from '../../components/ui/callout';
import { Card, CardBody, CardHeader } from '../../components/ui/card';
import { CountUp } from '../../components/ui/count-up';
import { Field, Input, NumberField, inputClass } from '../../components/ui/field';
import { Segmented } from '../../components/ui/segmented';
import { Select } from '../../components/ui/select';
import { Toggle } from '../../components/ui/switch';
import { CONFIG_KEY, cacheConfig, useConfig } from '../../hooks/use-config';
import { api } from '../../lib/api';
import { fmt, fmt2 } from '../../lib/format';

const YEARS = [2026, 2027, 2028, 2029, 2030];

export default function SettingsPanel() {
  const { config } = useConfig();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Settings>(config.settings);
  const [presetInput, setPresetInput] = useState('');

  const parsed = useMemo(() => settingsSchema.safeParse(draft), [draft]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(config.settings);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setWeight = (key: keyof Settings['weights'], value: number) =>
    setDraft((d) => ({ ...d, weights: { ...d.weights, [key]: value } }));

  const save = useMutation({
    mutationFn: () => api.saveSettings(draft),
    onSuccess: (cfg) => {
      queryClient.setQueryData(CONFIG_KEY, cfg);
      cacheConfig(cfg);
      toast.success('Ustawienia zapisane — kalkulatory wszystkich nauczycieli przeliczą się automatycznie.');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // What these settings mean for a reference teacher (10 + 10 + 5 hours a week, pensum 18).
  const preview = useMemo(() => {
    if (!parsed.success) return null;
    const calendar = buildCalendar({ settings: parsed.data, customDays: config.customDays });
    const plan = {
      ...createDefaultPlan(parsed.data),
      timetable: { ...emptyTimetable(), k12: [2, 2, 2, 2, 2], k34: [2, 2, 2, 2, 2], k5: [1, 1, 1, 1, 1] },
    };
    return calculate(plan, parsed.data, calendar);
  }, [parsed, config.customDays]);

  const ferie = feriePreset(draft.schoolYearStart, draft.voivodeship);
  const addPreset = () => {
    const n = Number(presetInput.replace(',', '.'));
    if (!Number.isFinite(n) || n < 1 || n > 60) return toast.error('Podaj pensum od 1 do 60 godzin.');
    if (!draft.pensumPresets.includes(n)) set('pensumPresets', [...draft.pensumPresets, n].sort((a, b) => a - b));
    setPresetInput('');
  };

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <CardHeader icon={<School className="size-5" />} title="Szkoła i rok szkolny" description="Rok szkolny wyznacza kalendarz w tabeli; ferie dobierane są na podstawie województwa." />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <Field label="Nazwa szkoły" className="sm:col-span-2" error={parsed.success ? undefined : undefined}>
              {(id) => <Input id={id} value={draft.schoolName} maxLength={160} onChange={(e) => set('schoolName', e.target.value)} />}
            </Field>
            <Field label="Rok szkolny">
              {(id) => (
                <Select id={id} value={String(draft.schoolYearStart)} onChange={(v) => set('schoolYearStart', Number(v))} options={YEARS.map((y) => ({ value: String(y), label: `${y}/${y + 1}` }))} />
              )}
            </Field>
            <Field
              label="Województwo (ferie zimowe)"
              hint={ferie ? `Ferie: ${formatDMY(ferie.from)} – ${formatDMY(ferie.to)}` : 'Brak danych o feriach dla tego roku — dodaj je w kalendarzu.'}
            >
              {(id) => (
                <Select id={id} value={draft.voivodeship} onChange={(v) => set('voivodeship', v)} options={VOIVODESHIPS.map((v) => ({ value: v.id, label: v.label }))} />
              )}
            </Field>
            <Field label="Zajęcia w klasach 5 trwają do (włącznie)">
              {(id) => <input id={id} type="date" className={inputClass} value={draft.class5EndDate} onChange={(e) => set('class5EndDate', e.target.value)} />}
            </Field>
            <Field label="Termin oddania tabeli">
              {(id) => <input id={id} type="datetime-local" className={inputClass} value={draft.submissionDeadline} onChange={(e) => set('submissionDeadline', e.target.value)} />}
            </Field>
            <Field label="Komunikat na stronie głównej" className="sm:col-span-2" hint="np. „Przypominamy o zmianie planu od 5 października 2026.”">
              {(id) => <textarea id={id} rows={2} maxLength={400} className={`${inputClass} h-auto py-2`} value={draft.announcement} onChange={(e) => set('announcement', e.target.value)} />}
            </Field>
            <div className="sm:col-span-2">
              <Toggle checked={draft.denIsDayOff} onChange={(v) => set('denIsDayOff', v)} label="Dzień Edukacji Narodowej (14 października) jest dniem wolnym od zajęć" description="Wyłącz, jeśli w tej szkole w ten dzień odbywają się zajęcia." />
            </div>
          </CardBody>
        </Card>

        <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <CardHeader icon={<Percent className="size-5" />} title="Wagi godzinowe (wariant 1)" description="Godzina w klasach 1–2 waży 1, w klasach 3–4 około 0,9, w klasach 5 około 0,8 — dostosuj, jeśli dyrektor zmieni zasady." />
          <CardBody className="space-y-5">
            {([
              ['k12', 'Klasy 1–2', 'Pełny rok szkolny'],
              ['k34', 'Klasy 3–4', 'Praktyki uczniowskie skracają rok (~0,9)'],
              ['k5', 'Klasy 5', 'Zajęcia do 30 kwietnia (~0,8)'],
              ['individual', 'Nauczanie indywidualne wliczone do etatu', 'Tylko gdy nauczyciel ma je w wymiarze'],
            ] as const).map(([key, label, hint]) => (
              <div key={key} className="grid items-center gap-x-5 gap-y-1 sm:grid-cols-[1fr_minmax(0,1.4fr)_96px]">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted">{hint}</p>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={1.2}
                  step={0.01}
                  value={draft.weights[key]}
                  onChange={(e) => setWeight(key, Number(e.target.value))}
                  aria-label={`Waga: ${label}`}
                  className="h-2 w-full cursor-pointer accent-[var(--brand)]"
                />
                <NumberField value={draft.weights[key]} min={0} max={2} step={0.01} onChange={(v) => setWeight(key, v)} aria-label={`Waga (liczba): ${label}`} />
              </div>
            ))}
          </CardBody>
        </Card>

        <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <CardHeader icon={<SlidersHorizontal className="size-5" />} title="Parametry obliczeń" description="Reguły rozliczania obu wariantów." />
          <CardBody className="grid gap-6 sm:grid-cols-2">
            <Field label="Tygodni w miesiącu" hint="Do wyliczenia nadgodzin miesięcznych (domyślnie 4,16).">
              {(id) => <NumberField id={id} value={draft.weeksPerMonth} min={3} max={5} step={0.01} onChange={(v) => set('weeksPerMonth', v)} />}
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Zaokrąglanie godzin</span>
              <Segmented
                aria-label="Zaokrąglanie"
                value={draft.rounding}
                onChange={(v) => set('rounding', v)}
                options={[
                  { value: 'nearest', label: 'Do najbliższej' },
                  { value: 'up', label: 'W górę' },
                  { value: 'down', label: 'W dół' },
                ]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Dni robocze w odliczeniu za nieobecność</span>
              <Segmented
                aria-label="Dni robocze"
                value={draft.workdaysBasis}
                onChange={(v) => set('workdaysBasis', v)}
                options={[
                  { value: 'working-days', label: 'Pn–pt bez świąt' },
                  { value: 'school-days', label: 'Dni zajęć' },
                ]}
              />
              <p className="text-xs text-muted">Wrzesień 2026 ma 22 dni robocze — tak jak w przykładzie dyrektora.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Liczenie dni nieobecności</span>
              <Segmented
                aria-label="Liczenie nieobecności"
                value={draft.absenceCounting}
                onChange={(v) => set('absenceCounting', v)}
                options={[
                  { value: 'lesson-days', label: 'Tylko dni z lekcjami' },
                  { value: 'all-days', label: 'Wszystkie dni' },
                ]}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[13px] font-medium">Dni egzaminów (żółte)</span>
              <Segmented
                aria-label="Dni egzaminów"
                value={draft.examDays}
                onChange={(v) => set('examDays', v)}
                options={[
                  { value: 'neutral', label: 'Neutralne — nadgodziny niepłatne' },
                  { value: 'normal', label: 'Jak zwykłe dni zajęć' },
                ]}
              />
            </div>
          </CardBody>
        </Card>

        <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <CardHeader title="Pensum i wymiary etatu" description="Lista wymiarów pokazywana nauczycielom (np. 18, 20, 22, 30)." />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {draft.pensumPresets.map((p) => (
                <Badge key={p} tone={p === draft.defaultPensum ? 'brand' : 'neutral'} className="gap-1.5 py-1 pr-1.5 pl-3 text-sm">
                  {fmt(p)} godz.
                  {draft.pensumPresets.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Usuń ${p}`}
                      className="grid size-5 place-items-center rounded-full hover:bg-ink/10"
                      onClick={() => {
                        const next = draft.pensumPresets.filter((x) => x !== p);
                        setDraft((d) => ({ ...d, pensumPresets: next, defaultPensum: d.defaultPensum === p ? next[0]! : d.defaultPensum }));
                      }}
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </Badge>
              ))}
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addPreset();
                }}
              >
                <Input value={presetInput} onChange={(e) => setPresetInput(e.target.value)} placeholder="np. 26" className="h-9 w-24" inputMode="decimal" aria-label="Nowe pensum" />
                <Button type="submit" size="sm">Dodaj</Button>
              </form>
            </div>
            <Field label="Pensum domyślne" className="max-w-56">
              {(id) => <Select id={id} value={String(draft.defaultPensum)} onChange={(v) => set('defaultPensum', Number(v))} options={draft.pensumPresets.map((p) => ({ value: String(p), label: `${fmt(p)} godz.` }))} />}
            </Field>
          </CardBody>
        </Card>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24">
        <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden">
          <CardHeader icon={<Calculator className="size-5" />} title="Podgląd wpływu" description="Nauczyciel z przydziałem 10 + 10 + 5 godz., pensum 18." />
          <CardBody className="space-y-4">
            {preview ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Tile label="Godziny ważone" value={preview.v1.weightedHours} decimals={2} />
                  <Tile label="Wariant 1 / mies." value={preview.v1.monthlyRounded} suffix="godz." />
                  <Tile label="Wariant 1 / rok" value={preview.v1.total} suffix="godz." />
                  <Tile label="Wariant 2 / rok" value={preview.v2.total} suffix="godz." />
                </div>
                <p className="text-xs text-muted">
                  {fmt2(preview.v1.weeklyOvertime)} × {fmt2(draft.weeksPerMonth)} = {fmt2(preview.v1.monthlyRaw)} → {preview.v1.monthlyRounded}
                </p>
              </>
            ) : (
              <Callout tone="warn" title="Popraw ustawienia">
                {parsed.success ? '' : (parsed.error.issues[0]?.message ?? 'Niepoprawne wartości.')}
              </Callout>
            )}
          </CardBody>
        </Card>

        <motion.div layout className="glass sticky bottom-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line p-3 shadow-pop">
          <Button variant="primary" className="flex-1" disabled={!dirty || !parsed.success || save.isPending} onClick={() => save.mutate()}>
            <Save className="size-4" /> {save.isPending ? 'Zapisywanie…' : 'Zapisz ustawienia'}
          </Button>
          <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(config.settings)}>
            <RotateCcw className="size-4" /> Cofnij
          </Button>
          <Button variant="ghost" onClick={() => setDraft(DEFAULT_SETTINGS)} title="Wczytaj wartości fabryczne do formularza (bez zapisu)">
            Domyślne
          </Button>
          {dirty && <p className="w-full text-xs text-warn">Masz niezapisane zmiany.</p>}
        </motion.div>
      </aside>
    </div>
  );
}

function Tile({ label, value, decimals = 0, suffix }: { label: string; value: number; decimals?: number; suffix?: string }) {
  return (
    <div className="rounded-xl bg-surface-2/70 p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1">
        <CountUp value={value} decimals={decimals} className="num text-xl font-semibold" />
        {suffix && <span className="text-xs text-muted">{suffix}</span>}
      </p>
    </div>
  );
}
