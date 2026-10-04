import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

const tones = {
  neutral: 'bg-surface-2 text-muted',
  brand: 'bg-brand-soft text-brand',
  ok: 'bg-ok/12 text-ok',
  warn: 'bg-warn/15 text-warn',
  danger: 'bg-danger/12 text-danger',
} as const;

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
