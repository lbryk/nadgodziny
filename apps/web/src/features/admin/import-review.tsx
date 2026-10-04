import {
  DAY_KIND_LABEL,
  EDITABLE_KINDS,
  WEEKDAY_LONG_PL,
  formatDMY,
  weekdayOf,
  type CustomDay,
} from '@nadgodziny/core';
import { Check } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/field';
import { cn } from '../../lib/cn';

export interface Candidate extends CustomDay {
  id: string;
  selected: boolean;
  source?: string;
}

const kindSelect =
  'h-9 rounded-lg border border-line bg-surface px-2 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15';

/** Lets the administrator verify, fix and pick what was read from a file, a photo or pasted text. */
export function ImportReview({
  items,
  onChange,
  onApply,
  existing,
}: {
  items: Candidate[];
  onChange: (items: Candidate[]) => void;
  onApply: (selected: CustomDay[]) => void;
  existing: Set<string>;
}) {
  const selected = items.filter((i) => i.selected);
  const patch = (id: string, p: Partial<Candidate>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...p } : i)));

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          Znaleziono <b>{items.length}</b> {items.length === 1 ? 'dzień' : 'dni'} — zaznaczono{' '}
          <b>{selected.length}</b>. Sprawdź daty i rodzaje przed dodaniem.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange(items.map((i) => ({ ...i, selected: true })))}
          >
            Zaznacz wszystkie
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange(items.map((i) => ({ ...i, selected: false })))}
          >
            Odznacz
          </Button>
        </div>
      </div>

      <ul className="scroll-thin max-h-80 space-y-1.5 overflow-y-auto rounded-xl border border-line p-2">
        <AnimatePresence initial={false}>
          {items.map((c) => (
            <motion.li
              key={c.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                'grid items-center gap-2 rounded-lg px-2 py-1.5 sm:grid-cols-[28px_150px_170px_1fr]',
                c.selected ? 'bg-brand-soft/60' : 'opacity-60',
              )}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={c.selected}
                aria-label={`Dodaj ${formatDMY(c.date)}`}
                onClick={() => patch(c.id, { selected: !c.selected })}
                className={cn(
                  'grid size-6 place-items-center rounded-md border',
                  c.selected
                    ? 'border-brand bg-brand text-white dark:text-[#0b0e1a]'
                    : 'border-line bg-surface',
                )}
              >
                {c.selected && <Check className="size-4" />}
              </button>
              <div className="text-sm">
                <span className="num font-medium">{formatDMY(c.date)}</span>
                <span className="ml-2 text-xs text-muted">
                  {WEEKDAY_LONG_PL[weekdayOf(c.date) - 1]}
                </span>
                {existing.has(c.date) && (
                  <span className="ml-2 text-[11px] text-warn">nadpisze</span>
                )}
              </div>
              <select
                className={kindSelect}
                value={c.kind}
                aria-label="Rodzaj dnia"
                onChange={(e) => patch(c.id, { kind: e.target.value as Candidate['kind'] })}
              >
                {EDITABLE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {DAY_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <Input
                className="h-9"
                value={c.label ?? ''}
                aria-label="Opis"
                title={c.source}
                onChange={(e) => patch(c.id, { label: e.target.value })}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="flex justify-end">
        <Button
          variant="primary"
          disabled={selected.length === 0}
          onClick={() =>
            onApply(
              selected.map(({ date, kind, label }) => ({
                date,
                kind,
                ...(label ? { label } : {}),
              })),
            )
          }
        >
          Dodaj zaznaczone ({selected.length}) do kalendarza
        </Button>
      </div>
    </motion.div>
  );
}
