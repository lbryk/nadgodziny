import {
  WEEKDAY_LONG_PL,
  applyDayHours,
  emptyHours,
  tallyLessons,
  type ApplyMode,
  type DayBlock,
  type DetectedLesson,
  type LessonGroup,
} from '@nadgodziny/core';
import { ClipboardPaste, FileText, FileUp, ImageUp, Plus, ScanText, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Callout } from '../../../components/ui/callout';
import { CountUp } from '../../../components/ui/count-up';
import { Modal } from '../../../components/ui/dialog';
import { inputClass } from '../../../components/ui/field';
import { Segmented } from '../../../components/ui/segmented';
import { useCalc } from '../../../hooks/calc-context';
import { cn } from '../../../lib/cn';
import { fmt } from '../../../lib/format';
import { usePlanStore } from '../../../state/plan-store';
import { extractPlan, sourceKindOf } from './extract';

interface ReviewLesson extends DetectedLesson {
  id: string;
  selected: boolean;
}

interface ReviewBlock {
  id: string;
  weekday: number | null;
  source: string;
  lessons: ReviewLesson[];
}

let seq = 0;
const nextId = (p: string) => `${p}${(seq += 1)}`;

const toReview = (blocks: DayBlock[], source: string): ReviewBlock[] =>
  blocks.map((b) => ({
    id: nextId('b'),
    weekday: b.weekday,
    source,
    lessons: b.lessons.map((l) => ({ ...l, id: nextId('l'), selected: l.confident })),
  }));

const GROUP_OPTIONS: { value: LessonGroup | ''; label: string }[] = [
  { value: 'k12', label: 'Klasy 1–2' },
  { value: 'k34', label: 'Klasy 3–4' },
  { value: 'k5', label: 'Klasy 5' },
  { value: 'ind', label: 'Indywidualne' },
  { value: '', label: '— wybierz —' },
];

const DAY_SHORT = ['Pn', 'Wt', 'Śr', 'Czw', 'Pt'];
const selectClass =
  'h-9 rounded-lg border border-line bg-surface px-2 text-sm focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none';

export function PlanImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { plan } = useCalc();
  const setTimetable = usePlanStore((s) => s.setTimetable);
  const [blocks, setBlocks] = useState<ReviewBlock[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState<ApplyMode>('replace');
  const [pasted, setPasted] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (!open) {
      setBlocks([]);
      setPasted('');
      setBusy(false);
    }
  }, [open]);

  const load = useCallback(async (file: File) => {
    if (!sourceKindOf(file)) {
      toast.error('Obsługiwane są: zdjęcia (PNG, JPG), PDF, Word (DOCX, DOC) i pliki tekstowe.');
      return;
    }
    setBusy(true);
    setProgress(0);
    setStatus('Przygotowanie…');
    try {
      const result = await extractPlan(file, (p, s) => {
        setProgress(p);
        setStatus(s);
      });
      const found = toReview(result.blocks, result.sourceName);
      const count = found.reduce((a, b) => a + b.lessons.length, 0);
      if (count === 0) {
        toast.warning(
          'Nie rozpoznano żadnych lekcji. Spróbuj wyraźniejszego zdjęcia lub dodaj lekcje ręcznie.',
        );
      } else {
        toast.success(
          `Rozpoznano ${count} ${count === 1 ? 'lekcję' : 'lekcji'} — sprawdź je poniżej.`,
        );
      }
      setBlocks((prev) => [...prev, ...found]);
    } catch (error) {
      console.error(error);
      toast.error((error as Error).message || 'Nie udało się odczytać pliku.');
    } finally {
      setBusy(false);
      setStatus('');
    }
  }, []);

  // a screenshot pasted with Ctrl+V
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === 'TEXTAREA') return;
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith('image/'),
      );
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        void load(new File([file], `zrzut-${Date.now()}.png`, { type: file.type }));
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open, load]);

  const patchBlock = (id: string, patch: Partial<ReviewBlock>) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const patchLesson = (blockId: string, lessonId: string, patch: Partial<ReviewLesson>) =>
    setBlocks((bs) =>
      bs.map((b) =>
        b.id === blockId
          ? { ...b, lessons: b.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)) }
          : b,
      ),
    );

  const active = blocks.map((b) => ({
    block: b,
    hours: tallyLessons(b.lessons.filter((l) => l.selected)),
  }));
  const missingDay = active.some(
    ({ block, hours }) => block.weekday === null && Object.values(hours).some((v) => v > 0),
  );
  const unclassified = blocks.some((b) => b.lessons.some((l) => l.selected && l.group === null));

  // combine blocks that point at the same weekday (e.g. morning and afternoon photographed separately)
  const perDay = new Map<number, ReturnType<typeof emptyHours>>();
  for (const { block, hours } of active) {
    if (block.weekday === null) continue;
    const sum = perDay.get(block.weekday) ?? emptyHours();
    for (const g of ['k12', 'k34', 'k5', 'ind'] as const)
      sum[g] = Math.round((sum[g] + hours[g]) * 100) / 100;
    perDay.set(block.weekday, sum);
  }
  const total = (h: ReturnType<typeof emptyHours>) => h.k12 + h.k34 + h.k5 + h.ind;
  const canApply = perDay.size > 0 && !missingDay && !unclassified;

  const apply = () => {
    let next = plan.timetable;
    for (const [day, hours] of perDay) next = applyDayHours(next, day, hours, mode);
    setTimetable(next);
    const days = [...perDay.entries()].sort((a, b) => a[0] - b[0]);
    toast.success(
      `Zaktualizowano przydział: ${days.map(([d, h]) => `${DAY_SHORT[d]} ${fmt(total(h))} godz.`).join(', ')}.`,
    );
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Wczytaj godziny z planu lekcji"
      description="Zdjęcie lub zrzut ekranu z dziennika, plik PDF albo Word. Zdjęcie jednego dnia wystarczy — godziny z tego dnia zostaną zsumowane."
      className="sm:max-w-3xl"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button
            variant="primary"
            disabled={!canApply || busy}
            onClick={apply}
            data-testid="plan-apply"
          >
            Zastosuj do przydziału
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div
          role="button"
          tabIndex={0}
          data-testid="plan-dropzone"
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f) void load(f);
          }}
          className={cn(
            'grid cursor-pointer place-items-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center transition-colors',
            over ? 'border-brand bg-brand-soft' : 'border-line hover:border-brand/50',
            busy && 'pointer-events-none opacity-60',
            blocks.length > 0 && 'p-3',
          )}
        >
          <div className="flex items-center gap-3 text-brand">
            <ImageUp className="size-7" />
            <FileText className="size-7" />
            <FileUp className="size-7" />
          </div>
          <p className="text-sm font-medium">
            {blocks.length
              ? 'Dodaj kolejne zdjęcie lub plik (np. następny dzień)'
              : 'Upuść plik albo kliknij, aby wybrać'}
          </p>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>PNG / JPG · PDF · DOCX · DOC · TXT</span>
            <span className="flex items-center gap-1">
              <ClipboardPaste className="size-3.5" /> zrzut ekranu:{' '}
              <kbd className="rounded border border-line bg-surface-2 px-1">Ctrl</kbd>+
              <kbd className="rounded border border-line bg-surface-2 px-1">V</kbd>
            </span>
          </p>
          <input
            ref={fileRef}
            type="file"
            hidden
            data-testid="plan-file"
            accept="image/*,.pdf,.doc,.docx,.txt,.csv,application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void load(f);
            }}
          />
        </div>

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

        {blocks.length === 0 && !busy && (
          <details className="rounded-xl border border-line px-3 py-2 text-sm">
            <summary className="cursor-pointer text-muted">
              Albo wklej tekst planu (np. skopiowany z dziennika)
            </summary>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={6}
              aria-label="Tekst planu lekcji"
              className={cn(inputClass, 'mt-2 h-auto py-2 font-mono text-xs')}
              placeholder={
                'Poniedziałek\n1 07:45-08:30 Matematyka 3TE s.12\n2 08:40-09:25 Matematyka 3TE s.12'
              }
            />
            <Button
              size="sm"
              className="mt-2"
              disabled={!pasted.trim()}
              onClick={() => {
                void load(new File([pasted], 'wklejony-plan.txt', { type: 'text/plain' }));
              }}
            >
              Rozpoznaj lekcje
            </Button>
          </details>
        )}

        <AnimatePresence initial={false}>
          {blocks.map(({ id }, index) => {
            const block = blocks[index]!;
            const hours = active[index]!.hours;
            const sum = total(hours);
            return (
              <motion.section
                key={id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 rounded-2xl border border-line bg-surface-2/40 p-4"
                data-testid="plan-block"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <ScanText className="size-4 text-brand" />
                  <span className="text-sm font-medium">{block.source}</span>
                  <label className="ml-auto flex items-center gap-2 text-sm">
                    <span className="text-muted">Dzień tygodnia</span>
                    <select
                      className={cn(
                        selectClass,
                        block.weekday === null && 'border-warn ring-2 ring-warn/30',
                      )}
                      aria-label="Dzień tygodnia dla tego zestawu"
                      value={block.weekday ?? ''}
                      onChange={(e) =>
                        patchBlock(id, {
                          weekday: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                    >
                      <option value="">— wybierz dzień —</option>
                      {WEEKDAY_LONG_PL.slice(0, 5).map((d, i) => (
                        <option key={d} value={i}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 hover:text-danger"
                    aria-label="Usuń ten zestaw"
                    onClick={() => setBlocks((bs) => bs.filter((b) => b.id !== id))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <ul className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {block.lessons.map((l) => (
                      <motion.li
                        key={l.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: l.selected ? 1 : 0.55, x: 0 }}
                        exit={{ opacity: 0, x: 24, height: 0 }}
                        className={cn(
                          'grid items-center gap-2 rounded-xl px-2.5 py-1.5 sm:grid-cols-[24px_minmax(0,1fr)_140px_72px_32px]',
                          l.selected ? 'bg-surface' : 'bg-surface/50',
                        )}
                        data-testid="plan-lesson"
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--brand)]"
                          checked={l.selected}
                          aria-label={`Uwzględnij: ${l.line}`}
                          onChange={(e) => patchLesson(id, l.id, { selected: e.target.checked })}
                        />
                        <div className="min-w-0 text-sm">
                          <span className="block truncate" title={l.line}>
                            {l.line}
                          </span>
                          <span className="flex gap-1.5 text-[11px] text-muted">
                            {l.time && <span className="num">{l.time}</span>}
                            {l.classLabel && <Badge tone="brand">{l.classLabel}</Badge>}
                            {!l.confident && <Badge tone="warn">brak klasy</Badge>}
                          </span>
                        </div>
                        <select
                          className={cn(
                            selectClass,
                            l.selected && l.group === null && 'border-warn',
                          )}
                          aria-label="Grupa klas"
                          value={l.group ?? ''}
                          onChange={(e) =>
                            patchLesson(id, l.id, {
                              group: (e.target.value || null) as LessonGroup | null,
                              ...(e.target.value ? { selected: true } : {}),
                            })
                          }
                        >
                          {GROUP_OPTIONS.map((o) => (
                            <option key={o.label} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          max={8}
                          step={0.5}
                          className={cn(selectClass, 'num w-full text-center')}
                          aria-label="Liczba godzin"
                          value={l.hours}
                          onChange={(e) =>
                            patchLesson(id, l.id, {
                              hours: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 hover:text-danger"
                          aria-label="Usuń lekcję"
                          onClick={() =>
                            setBlocks((bs) =>
                              bs.map((b) =>
                                b.id === id
                                  ? { ...b, lessons: b.lessons.filter((x) => x.id !== l.id) }
                                  : b,
                              ),
                            )
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      patchBlock(id, {
                        lessons: [
                          ...block.lessons,
                          {
                            id: nextId('l'),
                            line: 'Lekcja dodana ręcznie',
                            group: 'k12',
                            hours: 1,
                            confident: true,
                            selected: true,
                          },
                        ],
                      })
                    }
                  >
                    <Plus className="size-3.5" /> Dodaj lekcję
                  </Button>
                  <p
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm"
                    data-testid="plan-sum"
                  >
                    <span className="text-muted">Razem w tym dniu:</span>
                    <CountUp
                      value={sum}
                      decimals={1}
                      className="num text-xl font-semibold text-brand"
                    />
                    <span className="text-muted">godz.</span>
                    <span className="num text-xs text-muted">
                      kl. 1–2: {fmt(hours.k12)} · kl. 3–4: {fmt(hours.k34)} · kl. 5: {fmt(hours.k5)}{' '}
                      · indyw.: {fmt(hours.ind)}
                    </span>
                  </p>
                </div>
              </motion.section>
            );
          })}
        </AnimatePresence>

        {blocks.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">Co zrobić z godzinami w wybranych dniach?</span>
              <Segmented<ApplyMode>
                aria-label="Sposób zapisu"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'replace', label: 'Zastąp' },
                  { value: 'add', label: 'Dodaj do istniejących' },
                ]}
              />
            </div>
            {missingDay && (
              <Callout tone="warn" title="Wybierz dzień tygodnia">
                Zestaw bez dnia nie zostanie zapisany — wskaż, którego dnia dotyczy zdjęcie lub
                plik.
              </Callout>
            )}
            {unclassified && (
              <Callout tone="warn" title="Przypisz grupę klas">
                Zaznaczone lekcje bez klasy trzeba przypisać do grupy (kl. 1–2, 3–4, 5 albo
                indywidualne) albo odznaczyć.
              </Callout>
            )}
            {[...perDay.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([d, h]) => {
                const t = plan.timetable;
                const before = t.k12[d]! + t.k34[d]! + t.k5[d]! + t.ind[d]!;
                const after = mode === 'add' ? before + total(h) : total(h);
                return (
                  <p key={d} className="num text-sm text-muted">
                    <strong className="text-ink">{WEEKDAY_LONG_PL[d]}</strong>: {fmt(before)} →{' '}
                    <strong className="text-ink">{fmt(after)}</strong> godz.
                  </p>
                );
              })}
          </div>
        )}

        <Callout title="Jak to działa?">
          Każdy wiersz planu to jedna godzina lekcyjna, przypisana do grupy po klasie (np. 1TA → kl.
          1–2, 3TE → kl. 3–4, 5TI → kl. 5). Zdjęcie jednego dnia sumuje lekcje z tego dnia;
          tygodniowy plan z kolumnami Pn–Pt rozdziela się na dni automatycznie. Rozpoznanie jest
          podpowiedzią — sprawdź listę przed zapisem.
        </Callout>
      </div>
    </Modal>
  );
}
