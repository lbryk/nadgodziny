import { animate, useMotionValue, useReducedMotion, useTransform, motion } from 'motion/react';
import { useEffect } from 'react';
import { fmt } from '../../lib/format';

/** Animated number that eases to its new value whenever it changes. */
export function CountUp({
  value,
  decimals = 0,
  className,
  duration = 0.7,
}: {
  value: number;
  decimals?: number;
  className?: string;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) =>
    decimals > 0 ? fmt(Number(v.toFixed(decimals))) : fmt(Math.round(v)),
  );

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value, reduce, duration, mv]);

  return <motion.span className={className}>{text}</motion.span>;
}
