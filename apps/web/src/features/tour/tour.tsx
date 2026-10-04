import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import { CHAPTER_LABEL, stepsFor, type Placement } from './steps';
import { useTourStore } from './tour-store';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 8;
const GAP = 14;
const MARGIN = 12;
const MOBILE = 640;

function sameBox(a: Box | null, b: Box | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.w - b.w) < 0.5 &&
    Math.abs(a.h - b.h) < 0.5
  );
}

/** Brings the highlighted element into view, leaving room for the sticky header. */
function ensureVisible(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  if (r.top >= 88 && r.bottom <= vh - 24) return;
  const wanted = Math.min(r.height, vh * 0.5);
  const top = window.scrollY + r.top - Math.max(96, (vh - wanted) / 3);
  window.scrollTo({
    top: Math.max(0, top),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}

function placeCard(
  target: Box | null,
  card: { w: number; h: number },
  vw: number,
  vh: number,
  preferred: Placement,
) {
  if (vw < MOBILE) return { x: MARGIN, y: Math.max(MARGIN, vh - card.h - MARGIN) };
  const clamp = (v: number, min: number, max: number) =>
    Math.min(Math.max(v, min), Math.max(min, max));
  if (!target) return { x: (vw - card.w) / 2, y: Math.max(MARGIN, (vh - card.h) / 2) };

  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  const options: Record<Exclude<Placement, 'auto'>, { x: number; y: number; fits: boolean }> = {
    bottom: {
      x: clamp(cx - card.w / 2, MARGIN, vw - card.w - MARGIN),
      y: target.y + target.h + GAP,
      fits: target.y + target.h + GAP + card.h <= vh - MARGIN,
    },
    top: {
      x: clamp(cx - card.w / 2, MARGIN, vw - card.w - MARGIN),
      y: target.y - GAP - card.h,
      fits: target.y - GAP - card.h >= MARGIN,
    },
    right: {
      x: target.x + target.w + GAP,
      y: clamp(cy - card.h / 2, MARGIN, vh - card.h - MARGIN),
      fits: target.x + target.w + GAP + card.w <= vw - MARGIN,
    },
    left: {
      x: target.x - GAP - card.w,
      y: clamp(cy - card.h / 2, MARGIN, vh - card.h - MARGIN),
      fits: target.x - GAP - card.w >= MARGIN,
    },
  };
  const order: Exclude<Placement, 'auto'>[] =
    preferred === 'auto'
      ? ['bottom', 'top', 'right', 'left']
      : ([preferred, 'bottom', 'top', 'right', 'left'].filter(
          (p, i, a) => a.indexOf(p) === i,
        ) as Exclude<Placement, 'auto'>[]);
  const hit = order.find((p) => options[p].fits);
  if (hit) return { x: options[hit].x, y: options[hit].y };
  // nothing fits next to the target (it is huge): dock the card inside the viewport
  return { x: clamp(cx - card.w / 2, MARGIN, vw - card.w - MARGIN), y: vh - card.h - MARGIN };
}

export function Tour() {
  const { open, chapter, index, go, close, setChapter } = useTourStore();
  const navigate = useNavigate();
  const location = useLocation();
  const steps = stepsFor(chapter);
  const step = steps[Math.min(index, steps.length - 1)]!;
  const last = index >= steps.length - 1;

  const [box, setBox] = useState<Box | null>(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [cardSize, setCardSize] = useState({ w: 400, h: 300 });
  const cardRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  /* ---- first visit: offer the tour once, on the calculator page ---------------------------- */
  useEffect(() => {
    if (useTourStore.getState().seen || location.pathname !== '/') return;
    const timer = setTimeout(() => {
      if (!useTourStore.getState().seen) useTourStore.getState().start('all');
    }, 900);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  /* ---- go to the page the step needs ------------------------------------------------------- */
  useEffect(() => {
    if (!open || !step.route) return;
    const current = `${location.pathname}${location.search}`;
    if (current !== step.route) navigate(step.route);
    // only when the step changes — the user may navigate away on purpose afterwards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step.id]);

  /* ---- follow the target (it may still be mounting, scrolling or animating) ----------------- */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let raf = 0;
    let scrolled = false;
    const started = performance.now();

    const tick = () => {
      if (cancelled) return;
      const el = step.target ? document.querySelector<HTMLElement>(step.target) : null;
      if (el) {
        if (!scrolled) {
          scrolled = true;
          ensureVisible(el);
        }
        const r = el.getBoundingClientRect();
        // clip to the viewport so a huge element is still highlighted sensibly
        const x = Math.max(r.left, 0);
        const y = Math.max(r.top, 0);
        const next: Box = {
          x,
          y,
          w: Math.max(0, Math.min(r.right, window.innerWidth) - x),
          h: Math.max(0, Math.min(r.bottom, window.innerHeight) - y),
        };
        setBox((prev) => (sameBox(prev, next) ? prev : next));
      } else if (step.target && performance.now() - started > 2500) {
        setBox(null); // target never showed up → centred card
      }
      raf = requestAnimationFrame(tick);
    };

    setBox(null);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [open, step.id, step.target]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !cardRef.current) return;
    const el = cardRef.current;
    const measure = () => setCardSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, step.id]);

  /* ---- focus, keyboard ----------------------------------------------------------------------- */
  const next = useCallback(() => (last ? close(true) : go(index + 1)), [last, close, go, index]);
  const prev = useCallback(() => index > 0 && go(index - 1), [go, index]);
  const dismiss = useCallback(() => {
    const s = useTourStore.getState();
    const total = stepsFor(s.chapter).length;
    close(false);
    if (s.index < total - 1) {
      toast('Samouczek zamknięty', {
        description: 'Wrócisz do niego w każdej chwili przyciskiem ? w nagłówku.',
        action: {
          label: 'Wznów',
          onClick: () => useTourStore.getState().start(s.chapter, s.index),
        },
      });
    }
  }, [close]);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    return () => returnFocus.current?.focus?.({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (open) cardRef.current?.focus({ preventScroll: true });
  }, [open, step.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismiss();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'Tab' && cardRef.current) {
        const focusable = Array.from(
          cardRef.current.querySelectorAll<HTMLElement>(
            'button, a[href], [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute('disabled'));
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const lastEl = focusable[focusable.length - 1]!;
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === cardRef.current)
        ) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, next, prev, dismiss]);

  if (typeof document === 'undefined') return null;

  const mobile = viewport.w < MOBILE;
  const width = mobile ? viewport.w - MARGIN * 2 : Math.min(400, viewport.w - MARGIN * 2);
  const pos = placeCard(
    box,
    { w: width, h: cardSize.h },
    viewport.w,
    viewport.h,
    step.placement ?? 'auto',
  );
  const hole = box
    ? { x: box.x - PAD, y: box.y - PAD, w: box.w + PAD * 2, h: box.h + PAD * 2 }
    : null;
  const Icon = step.icon;
  const Body = step.body;
  const allSteps = stepsFor('all');
  const firstRules = allSteps.findIndex((s) => s.chapter === 'rules');
  const part = step.chapter === 'ui' ? 1 : 2;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="tour"
          className="fixed inset-0 z-[80]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          data-testid="tour"
        >
          {/* dimmed page with a rounded hole around the target */}
          <svg className="absolute inset-0 size-full" aria-hidden>
            <defs>
              <mask id="tour-mask">
                <rect width="100%" height="100%" fill="white" />
                {hole && (
                  <motion.rect
                    rx={16}
                    fill="black"
                    initial={false}
                    animate={{ x: hole.x, y: hole.y, width: hole.w, height: hole.h }}
                    transition={{ type: 'spring', stiffness: 260, damping: 32 }}
                  />
                )}
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(6,9,22,0.66)" mask="url(#tour-mask)" />
            {hole && (
              <motion.rect
                rx={16}
                fill="none"
                stroke="var(--brand)"
                strokeWidth={2.5}
                className="tour-pulse"
                initial={false}
                animate={{ x: hole.x, y: hole.y, width: hole.w, height: hole.h }}
                transition={{ type: 'spring', stiffness: 260, damping: 32 }}
              />
            )}
          </svg>

          <motion.div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
            tabIndex={-1}
            className="absolute top-0 left-0 flex max-h-[min(78dvh,640px)] flex-col overflow-hidden rounded-3xl border border-line bg-surface text-ink shadow-pop outline-none"
            style={{ width }}
            initial={false}
            animate={{ x: pos.x, y: pos.y }}
            transition={{ type: 'spring', stiffness: 300, damping: 34 }}
          >
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span className="grid size-8 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
                  {chapter === 'all'
                    ? `Część ${part} z 2 · ${step.chapter === 'ui' ? 'Interfejs' : 'Rozliczanie nadgodzin'}`
                    : CHAPTER_LABEL[chapter]}
                </p>
                <p className="num text-xs text-muted">
                  Krok {index + 1} z {steps.length}
                </p>
              </div>
              {chapter === 'all' && (
                <div
                  className="hidden gap-1 rounded-lg bg-surface-2 p-0.5 text-[11px] font-medium sm:flex"
                  role="group"
                  aria-label="Przejdź do części"
                >
                  <button
                    type="button"
                    className={cn(
                      'rounded-md px-2 py-1',
                      step.chapter === 'ui' ? 'bg-surface shadow-sm' : 'text-muted hover:text-ink',
                    )}
                    onClick={() => go(0)}
                  >
                    Interfejs
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'rounded-md px-2 py-1',
                      step.chapter === 'rules'
                        ? 'bg-surface shadow-sm'
                        : 'text-muted hover:text-ink',
                    )}
                    onClick={() => go(firstRules)}
                  >
                    Zasady
                  </button>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Zamknij samouczek"
                onClick={dismiss}
                data-testid="tour-close"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div
              className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4"
              aria-live="polite"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${chapter}-${step.id}`}
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.16 }}
                  className="space-y-3 text-sm"
                >
                  <h2 id="tour-title" className="text-lg leading-snug font-semibold tracking-tight">
                    {step.title}
                  </h2>
                  <Body />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="border-t border-line bg-surface-2/50 px-4 py-3">
              <div className="mb-3 flex gap-1" aria-hidden>
                {steps.map((s, i) => (
                  <motion.button
                    key={s.id}
                    type="button"
                    tabIndex={-1}
                    onClick={() => go(i)}
                    className={cn('h-1.5 flex-1 rounded-full', i <= index ? 'bg-brand' : 'bg-line')}
                    animate={{
                      opacity: i === index ? 1 : i < index ? 0.7 : 0.9,
                      scaleY: i === index ? 1.5 : 1,
                    }}
                    title={s.title}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={dismiss}
                  className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
                  data-testid="tour-skip"
                >
                  Pomiń samouczek
                </button>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={prev} disabled={index === 0}>
                    <ArrowLeft className="size-3.5" /> Wstecz
                  </Button>
                  {index === 0 && chapter === 'all' ? (
                    <Button size="sm" variant="primary" onClick={next} data-testid="tour-next">
                      Zaczynamy <ArrowRight className="size-3.5" />
                    </Button>
                  ) : last ? (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => close(true)}
                      data-testid="tour-finish"
                    >
                      <Check className="size-3.5" /> Zakończ
                    </Button>
                  ) : (
                    <Button size="sm" variant="primary" onClick={next} data-testid="tour-next">
                      Dalej <ArrowRight className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              {chapter !== 'all' && last && (
                <button
                  type="button"
                  onClick={() => setChapter(chapter === 'ui' ? 'rules' : 'ui')}
                  className="mt-2 text-xs text-brand hover:underline"
                >
                  {chapter === 'ui'
                    ? 'Przejdź do zasad rozliczania →'
                    : '← Wróć do części o interfejsie'}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
