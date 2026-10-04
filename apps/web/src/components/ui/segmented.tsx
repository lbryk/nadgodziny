import { LayoutGroup, motion } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
  hint?: string;
}

/** Radio-group style pill selector with an animated thumb. */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  className,
  'aria-label': ariaLabel,
  size = 'md',
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
  'aria-label'?: string;
  size?: 'sm' | 'md';
}) {
  const group = useId();
  return (
    <LayoutGroup id={group}>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className={cn('inline-flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1', className)}
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={active}
              title={o.hint}
              onClick={() => onChange(o.value)}
              className={cn(
                'relative rounded-lg font-medium transition-colors',
                size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
                active ? 'text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {active && (
                <motion.span
                  layoutId="seg-thumb"
                  className="absolute inset-0 rounded-lg bg-surface shadow-sm ring-1 ring-line"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative z-10">{o.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
