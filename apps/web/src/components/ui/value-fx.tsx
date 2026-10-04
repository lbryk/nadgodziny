import { AnimatePresence, motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { fmt } from '../../lib/format';

interface Fx {
  id: number;
  delta: number;
}

let counter = 0;

/** Emits a short-lived `{ delta }` every time `value` changes (never on the first render). */
export function useValueFx(value: number, ms = 1100): Fx | null {
  const previous = useRef(value);
  const [fx, setFx] = useState<Fx | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (previous.current === value) return;
    const delta = Math.round((value - previous.current) * 100) / 100;
    previous.current = value;
    if (reduce || delta === 0) return;
    counter += 1;
    setFx({ id: counter, delta });
    const timer = setTimeout(() => setFx(null), ms);
    return () => clearTimeout(timer);
  }, [value, ms, reduce]);

  return fx;
}

/**
 * Visual feedback for typing or removing hours: the cell pops, a ring ripples out and a
 * "+2" / "−3" bubble floats up (green when hours are added, red when they are taken away).
 */
export const ValueFx = forwardRef<
  HTMLDivElement,
  { value: number; children: ReactNode; className?: string } & Omit<
    HTMLMotionProps<'div'>,
    'animate' | 'transition' | 'children' | 'className'
  >
>(function ValueFx({ value, children, className, ...rest }, ref) {
  const fx = useValueFx(value);
  const up = (fx?.delta ?? 0) > 0;
  const removed = fx !== null && value === 0 && !up;

  return (
    <motion.div
      ref={ref}
      {...rest}
      className={cn('relative', className)}
      animate={
        fx
          ? up
            ? { scale: [1, 1.14, 0.97, 1] }
            : removed
              ? { scale: [1, 0.86, 1.03, 1], rotate: [0, -3, 3, 0] }
              : { scale: [1, 0.94, 1.02, 1] }
          : { scale: 1, rotate: 0 }
      }
      transition={{ duration: 0.38, ease: 'easeOut' }}
    >
      {children}
      <AnimatePresence>
        {fx && (
          <motion.span
            key={`ring-${fx.id}`}
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-0 rounded-[inherit] ring-2',
              up ? 'ring-ok' : 'ring-danger',
            )}
            initial={{ opacity: 0.95, scale: 1 }}
            animate={{ opacity: 0, scale: 1.35 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
          />
        )}
        {fx && (
          <motion.span
            key={`bubble-${fx.id}`}
            aria-hidden
            className={cn(
              'num pointer-events-none absolute -top-1 left-1/2 z-30 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[11px] leading-none font-bold text-white shadow-md',
              up ? 'bg-ok' : 'bg-danger',
            )}
            initial={{ opacity: 0, y: 8, scale: 0.5 }}
            animate={{ opacity: 1, y: -16, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 420, damping: 20 }}
          >
            {up ? '+' : '−'}
            {fmt(Math.abs(fx.delta))}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

/** A number that flashes softly whenever it changes (row and month totals). */
export function FlashNumber({
  value,
  children,
  className,
}: {
  value: number;
  children: ReactNode;
  className?: string;
}) {
  const fx = useValueFx(value, 900);
  return (
    <span className={cn('relative inline-block', className)}>
      <AnimatePresence>
        {fx && (
          <motion.span
            key={fx.id}
            aria-hidden
            className={cn(
              'pointer-events-none absolute -inset-x-1 -inset-y-0.5 rounded-md',
              fx.delta > 0 ? 'bg-ok/30' : 'bg-danger/25',
            )}
            initial={{ opacity: 1, scale: 1.15 }}
            animate={{ opacity: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
      <span className="relative">{children}</span>
    </span>
  );
}
