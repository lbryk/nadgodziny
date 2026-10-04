import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DAY_KIND_LABEL,
  EDITABLE_KINDS,
  WEEKDAY_LONG_PL,
  buildCalendar,
  buildCalendarXml,
  eachDay,
  extractDaysFromText,
  formatDMY,
  isWeekend,
  parseCalendarIcs,
  parseCalendarXml,
  weekdayOf,
  type CustomDay,
} from '@nadgodziny/core';
import { saveAs } from 'file-saver';
import {
  CalendarPlus,
  FileCode2,
  ImageUp,
  ClipboardPaste,
  RotateCcw,
  Save,
  ScanText,
  Trash2,
  Type,
  UploadCloud,
  FileDown,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Callout } from '../../components/ui/callout';
import { Card, CardBody, CardHeader } from '../../components/ui/card';
import { Field, Input, inputClass } from '../../components/ui/field';
import { Segmented } from '../../components/ui/segmented';
import { Toggle } from '../../components/ui/switch';
import { CONFIG_KEY, cacheConfig, useConfig } from '../../hooks/use-config';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { ImportReview, type Candidate } from './import-review';

const kindSelect =
  'h-9 rounded-lg border border-line bg-surface px-2 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15';

const addSchema = z
  .object({
    mode: z.enum(['day', 'range']),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Wybierz datę.'),
    to: z.string(),
    kind: z.enum(EDITABLE_KINDS as [CustomDay['kind'], ...CustomDay['kind'][]]),
    label: z.string().max(160),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'range') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.to))
        ctx.addIssue({ code: 'custom', path: ['to'], message: 'Wybierz datę końcową.' });
      else if (v.to < v.from)
        ctx.addIssue({
          code: 'custom',
          path: ['to'],
          message: 'Data końcowa jest przed początkową.',
        });
      else if (eachDay(v.from, v.to).length > 150)
        ctx.addIssue({ code: 'custom', path: ['to'], message: 'Maksymalnie 150 dni naraz.' });
    }
  });
type AddValues = z.infer<typeof addSchema>;

type ImportMode = 'plik' | 'zdjecie' | 'tekst';

let candidateSeq = 0;
const toCandidates = (days: (CustomDay & { source?: string })[]): Candidate[] =>
  days.map((d) => ({ ...d, id: `c${(candidateSeq += 1)}`, selected: true }));

export default function CalendarPanel() {
  const { config } = useConfig();
  const queryClient = useQueryClient();
  const [days, setDays] = useState<CustomDay[]>(config.customDays);
  const [mode, setMode] = useState<ImportMode>('plik');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [replaceAll, setReplaceAll] = useState(false);
  const [filter, setFilter] = useState<'all' | CustomDay['kind']>('all');

  const dirty = JSON.stringify(days) !== JSON.stringify(config.customDays);
  const existing = useMemo(() => new Set(days.map((d) => d.date)), [days]);

  const save = useMutation({
    mutationFn: () => api.saveCalendar(days),
    onSuccess: (cfg) => {
      queryClient.setQueryData(CONFIG_KEY, cfg);
      cacheConfig(cfg);
      toast.success('Kalendarz zapisany — tabele nauczycieli zaktualizują się automatycznie.');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  /** Merge by date (the newest entry wins) and keep the list sorted. */
  const merge = useCallback((incoming: CustomDay[], replace = false) => {
    setDays((prev) => {
      const map = new Map((replace ? [] : prev).map((d) => [d.date, d] as const));
      for (const d of incoming) map.set(d.date, d);
      return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
    });
  }, []);

  const applyImport = (selected: CustomDay[]) => {
    merge(selected, replaceAll);
    setCandidates([]);
    toast.success(
      `Dodano ${selected.length} dni do kalendarza. Kliknij „Zapisz kalendarz”, aby opublikować.`,
    );
  };

  const preview = useMemo(() => {
    const before = buildCalendar({ settings: config.settings, customDays: config.customDays });
    const after = buildCalendar({ settings: config.settings, customDays: days });
    return after.months.map((m, i) => ({
      key: m.key,
      label: m.label.split(' ')[0]!,
      days: m.teachingDays,
      delta: m.teachingDays - before.months[i]!.teachingDays,
    }));
  }, [config.settings, config.customDays, days]);

  /* -------- single day / range form -------- */
  const form = useForm<AddValues>({
    resolver: zodResolver(addSchema),
    defaultValues: { mode: 'day', from: '', to: '', kind: 'director', label: '' },
  });
  const addMode = form.watch('mode');
  const submitAdd = form.handleSubmit((v) => {
    const dates = v.mode === 'day' ? [v.from] : eachDay(v.from, v.to).filter((d) => !isWeekend(d));
    if (dates.length === 0) return toast.error('W tym zakresie są tylko weekendy.');
    const label = v.label.trim() || undefined;
    merge(dates.map((date) => ({ date, kind: v.kind, ...(label ? { label } : {}) })));
    toast.success(`Dodano ${dates.length} ${dates.length === 1 ? 'dzień' : 'dni'} (niezapisane).`);
    form.reset({ ...v, from: '', to: '', label: '' });
  });

  const visible = days.filter((d) => filter === 'all' || d.kind === filter);

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <CardHeader
            icon={<CalendarPlus className="size-5" />}
            title="Dodaj dzień wolny lub egzamin"
            description="Formularz: pojedynczy dzień albo zakres (weekendy są pomijane)."
          />
          <CardBody>
            <form onSubmit={submitAdd} className="space-y-4" noValidate>
              <Controller
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <Segmented
                    aria-label="Tryb"
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: 'day', label: 'Jeden dzień' },
                      { value: 'range', label: 'Zakres dat' },
                    ]}
                  />
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={addMode === 'range' ? 'Od' : 'Data'}
                  error={form.formState.errors.from?.message}
                >
                  {(id) => (
                    <input id={id} type="date" className={inputClass} {...form.register('from')} />
                  )}
                </Field>
                {addMode === 'range' && (
                  <Field label="Do" error={form.formState.errors.to?.message}>
                    {(id) => (
                      <input id={id} type="date" className={inputClass} {...form.register('to')} />
                    )}
                  </Field>
                )}
                <Field label="Rodzaj">
                  {(id) => (
                    <select
                      id={id}
                      className={cn(kindSelect, 'h-10 w-full')}
                      {...form.register('kind')}
                    >
                      {EDITABLE_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {DAY_KIND_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Opis (opcjonalnie)">
                  {(id) => (
                    <Input
                      id={id}
                      maxLength={160}
                      placeholder="np. Rada pedagogiczna"
                      {...form.register('label')}
                    />
                  )}
                </Field>
              </div>
              <Button type="submit" variant="primary">
                <CalendarPlus className="size-4" /> Dodaj do kalendarza
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <CardHeader
            icon={<UploadCloud className="size-5" />}
            title="Import z pliku, zdjęcia lub tekstu"
            description="Zrzut ekranu lub zdjęcie kalendarza jest rozpoznawane w przeglądarce — nie opuszcza Twojego komputera."
          />
          <CardBody className="space-y-4">
            <Segmented
              aria-label="Źródło importu"
              value={mode}
              onChange={(m) => {
                setMode(m);
                setCandidates([]);
              }}
              options={[
                {
                  value: 'plik',
                  label: (
                    <span className="flex items-center gap-1.5">
                      <FileCode2 className="size-4" /> XML / ICS
                    </span>
                  ),
                },
                {
                  value: 'zdjecie',
                  label: (
                    <span className="flex items-center gap-1.5">
                      <ImageUp className="size-4" /> Zdjęcie / zrzut
                    </span>
                  ),
                },
                {
                  value: 'tekst',
                  label: (
                    <span className="flex items-center gap-1.5">
                      <Type className="size-4" /> Tekst
                    </span>
                  ),
                },
              ]}
            />
            {mode === 'plik' && (
              <FileImport
                schoolYearStart={config.settings.schoolYearStart}
                onFound={(c) => setCandidates(toCandidates(c))}
              />
            )}
            {mode === 'zdjecie' && (
              <PhotoImport
                schoolYearStart={config.settings.schoolYearStart}
                onFound={(c) => setCandidates(toCandidates(c))}
              />
            )}
            {mode === 'tekst' && (
              <TextImport
                schoolYearStart={config.settings.schoolYearStart}
                onFound={(c) => setCandidates(toCandidates(c))}
              />
            )}

            <AnimatePresence>
              {candidates.length > 0 && (
                <div className="space-y-3 border-t border-line pt-4">
                  <Toggle
                    checked={replaceAll}
                    onChange={setReplaceAll}
                    label="Zastąp wszystkie dotychczasowe dni"
                    description="Domyślnie nowe dni są dodawane, a te same daty nadpisywane."
                  />
                  <ImportReview
                    items={candidates}
                    onChange={setCandidates}
                    onApply={applyImport}
                    existing={existing}
                  />
                </div>
              )}
            </AnimatePresence>
          </CardBody>
        </Card>
      </div>

      <Card
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <CardHeader
          title={`Dni szkoły w kalendarzu (${days.length})`}
          description="Dni wolne ustalone przez dyrektora, egzaminy i inne nadpisania. Reszta (święta, przerwy, ferie) wynika z reguł i ustawień."
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  saveAs(
                    new Blob(
                      [
                        buildCalendarXml(
                          days,
                          `${config.settings.schoolYearStart}/${config.settings.schoolYearStart + 1}`,
                        ),
                      ],
                      { type: 'application/xml' },
                    ),
                    'kalendarz.xml',
                  )
                }
              >
                <FileDown className="size-3.5" /> Eksport XML
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={days.length === 0}
                onClick={() => setDays([])}
              >
                <Trash2 className="size-3.5" /> Usuń wszystkie
              </Button>
            </>
          }
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['all', ...EDITABLE_KINDS] as const).map((k) => {
              const count = k === 'all' ? days.length : days.filter((d) => d.kind === k).length;
              if (k !== 'all' && count === 0) return null;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    filter === k
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-line text-muted hover:text-ink',
                  )}
                >
                  {k === 'all' ? 'Wszystkie' : DAY_KIND_LABEL[k]}{' '}
                  <span className="num ml-1 opacity-70">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="scroll-thin max-h-[26rem] overflow-y-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface-2 text-xs text-muted">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Data</th>
                  <th className="hidden px-3 py-2.5 text-left font-medium sm:table-cell">Dzień</th>
                  <th className="px-3 py-2.5 text-left font-medium">Rodzaj</th>
                  <th className="px-3 py-2.5 text-left font-medium">Opis</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {visible.map((d) => (
                    <motion.tr
                      key={d.date}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-t border-line"
                    >
                      <td className="num px-3 py-1.5 whitespace-nowrap">{formatDMY(d.date)}</td>
                      <td className="hidden px-3 py-1.5 text-muted sm:table-cell">
                        {WEEKDAY_LONG_PL[weekdayOf(d.date) - 1]}
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          className={kindSelect}
                          aria-label={`Rodzaj dnia ${formatDMY(d.date)}`}
                          value={d.kind}
                          onChange={(e) =>
                            setDays((prev) =>
                              prev.map((x) =>
                                x.date === d.date
                                  ? { ...x, kind: e.target.value as CustomDay['kind'] }
                                  : x,
                              ),
                            )
                          }
                        >
                          {EDITABLE_KINDS.map((k) => (
                            <option key={k} value={k}>
                              {DAY_KIND_LABEL[k]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          className="h-9 min-w-40"
                          value={d.label ?? ''}
                          aria-label={`Opis dnia ${formatDMY(d.date)}`}
                          onChange={(e) =>
                            setDays((prev) =>
                              prev.map((x) =>
                                x.date === d.date
                                  ? { ...x, label: e.target.value || undefined }
                                  : x,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="px-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 hover:text-danger"
                          aria-label={`Usuń ${formatDMY(d.date)}`}
                          onClick={() => setDays((prev) => prev.filter((x) => x.date !== d.date))}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-muted">
                      Brak dni. Dodaj je formularzem lub zaimportuj z pliku, zdjęcia albo tekstu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted">Dni zajęć w miesiącu po zmianach</p>
            <div className="flex flex-wrap gap-2">
              {preview.map((m) => (
                <Badge key={m.key} tone={m.delta === 0 ? 'neutral' : m.delta < 0 ? 'warn' : 'ok'}>
                  {m.label} <b className="num">{m.days}</b>
                  {m.delta !== 0 && (
                    <span className="num">
                      ({m.delta > 0 ? '+' : ''}
                      {m.delta})
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <motion.div
        layout
        className="glass sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3 shadow-pop"
      >
        <Button variant="primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          <Save className="size-4" /> {save.isPending ? 'Zapisywanie…' : 'Zapisz kalendarz'}
        </Button>
        <Button variant="ghost" disabled={!dirty} onClick={() => setDays(config.customDays)}>
          <RotateCcw className="size-4" /> Odrzuć zmiany
        </Button>
        <p className={cn('text-sm', dirty ? 'text-warn' : 'text-muted')}>
          {dirty
            ? 'Masz niezapisane zmiany w kalendarzu.'
            : 'Kalendarz zsynchronizowany z serwerem.'}
        </p>
      </motion.div>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Import sources
 * ------------------------------------------------------------------------------------------- */

type Found = (CustomDay & { source?: string })[];

function Dropzone({
  accept,
  onFile,
  children,
  busy,
}: {
  accept: string;
  onFile: (file: File) => void;
  children: React.ReactNode;
  busy?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      className={cn(
        'grid cursor-pointer place-items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors',
        over ? 'border-brand bg-brand-soft' : 'border-line hover:border-brand/50',
        busy && 'pointer-events-none opacity-60',
      )}
      onClick={() => ref.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && ref.current?.click()}
    >
      {children}
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        data-testid="dropzone-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

function FileImport({ onFound }: { schoolYearStart: number; onFound: (days: Found) => void }) {
  const [paste, setPaste] = useState('');
  const parse = (text: string, name: string) => {
    try {
      const isIcs = /\.ics$/i.test(name) || text.includes('BEGIN:VCALENDAR');
      const result = isIcs ? parseCalendarIcs(text) : parseCalendarXml(text);
      result.warnings.forEach((w) => toast.warning(w));
      if (result.days.length) onFound(result.days);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="space-y-3">
      <Dropzone
        accept=".xml,.ics,text/xml,application/xml,text/calendar"
        onFile={async (f) => parse(await f.text(), f.name)}
      >
        <FileCode2 className="size-8 text-brand" />
        <p className="text-sm font-medium">Upuść plik XML lub ICS albo kliknij, aby wybrać</p>
        <p className="text-xs text-muted">
          Format XML:{' '}
          <code className="rounded bg-surface-2 px-1">
            &lt;dzien data="2026-10-14" typ="den"/&gt;
          </code>{' '}
          oraz{' '}
          <code className="rounded bg-surface-2 px-1">
            &lt;zakres od="…" do="…" typ="ferie"/&gt;
          </code>
        </p>
      </Dropzone>
      <details className="group rounded-xl border border-line px-3 py-2 text-sm">
        <summary className="cursor-pointer text-muted group-open:mb-2">
          Albo wklej zawartość pliku XML
        </summary>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={5}
          className={cn(inputClass, 'h-auto py-2 font-mono text-xs')}
          placeholder={'<kalendarz>\n  <dzien data="2026-10-14" typ="den"/>\n</kalendarz>'}
        />
        <Button
          className="mt-2"
          size="sm"
          disabled={!paste.trim()}
          onClick={() => parse(paste, 'wklejone.xml')}
        >
          Wczytaj XML
        </Button>
      </details>
    </div>
  );
}

function PhotoImport({
  schoolYearStart,
  onFound,
}: {
  schoolYearStart: number;
  onFound: (days: Found) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState('');

  const run = useCallback(
    async (file: Blob) => {
      if (file.size > 15 * 1024 * 1024) return toast.error('Obraz jest za duży (maks. 15 MB).');
      setBusy(true);
      setProgress(0);
      setStatus('Przygotowanie obrazu…');
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(file);
      });
      try {
        const { recognizeImage } = await import('./ocr');
        const recognized = await recognizeImage(file, (p, s) => {
          setProgress(p);
          setStatus(s);
        });
        setText(recognized);
        const result = extractDaysFromText(recognized, { schoolYearStart });
        result.warnings.forEach((w) => toast.warning(w));
        if (result.days.length) {
          onFound(result.days);
          toast.success(`Rozpoznano ${result.days.length} dni — sprawdź je poniżej.`);
        }
      } catch (e) {
        console.error(e);
        toast.error('Nie udało się rozpoznać tekstu na obrazie.');
      } finally {
        setBusy(false);
        setStatus('');
      }
    },
    [onFound, schoolYearStart],
  );

  // Ctrl+V with a screenshot in the clipboard
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith('image/'),
      );
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        void run(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [run]);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  return (
    <div className="space-y-3">
      <Dropzone accept="image/*" onFile={run} busy={busy}>
        <ScanText className="size-8 text-brand" />
        <p className="text-sm font-medium">Upuść zdjęcie lub zrzut ekranu kalendarza</p>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <ClipboardPaste className="size-3.5" /> Możesz też wkleić zrzut ekranu skrótem{' '}
          <kbd className="rounded border border-line bg-surface-2 px-1">Ctrl</kbd>+
          <kbd className="rounded border border-line bg-surface-2 px-1">V</kbd>
        </p>
      </Dropzone>

      {busy && (
        <div className="space-y-1.5" role="status" aria-live="polite">
          <div className="flex justify-between text-xs text-muted">
            <span>{status}</span>
            <span className="num">{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-brand to-accent"
              animate={{ width: `${Math.max(4, progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {preview && (
        <div className="grid gap-3 sm:grid-cols-2">
          <img
            src={preview}
            alt="Wczytany obraz"
            className="max-h-52 w-full rounded-xl border border-line object-contain"
          />
          <div>
            <p className="mb-1 text-xs font-medium text-muted">
              Rozpoznany tekst (możesz poprawić)
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              className={cn(inputClass, 'h-auto py-2 font-mono text-xs')}
              aria-label="Rozpoznany tekst"
            />
            <Button
              size="sm"
              className="mt-2"
              onClick={() => onFound(extractDaysFromText(text, { schoolYearStart }).days)}
            >
              Wyszukaj daty ponownie
            </Button>
          </div>
        </div>
      )}
      <Callout title="Jak uzyskać dobry wynik?">
        Wyraźne zdjęcie, bez cienia i perspektywy. Rozpoznanie jest podpowiedzią — zawsze sprawdź
        daty i rodzaje dni przed dodaniem do kalendarza.
      </Callout>
    </div>
  );
}

function TextImport({
  schoolYearStart,
  onFound,
}: {
  schoolYearStart: number;
  onFound: (days: Found) => void;
}) {
  const [text, setText] = useState('');
  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        aria-label="Tekst z datami"
        className={cn(inputClass, 'h-auto py-2')}
        placeholder={
          '14.10.2026 – Dzień Edukacji Narodowej\nFerie zimowe: 01.02 – 14.02.2027\nEgzaminy: 4-7 maja 2027'
        }
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Jedna pozycja w wierszu. Rozumiemy m.in. 14.10.2026, 01.02 – 14.02.2027, 18-31 stycznia
          2027.
        </p>
        <Button
          variant="primary"
          disabled={!text.trim()}
          onClick={() => {
            const result = extractDaysFromText(text, { schoolYearStart });
            result.warnings.forEach((w) => toast.warning(w));
            if (result.days.length) onFound(result.days);
          }}
        >
          Rozpoznaj daty
        </Button>
      </div>
    </div>
  );
}
