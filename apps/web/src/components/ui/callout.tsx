import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

const tones = {
  info: { box: 'border-brand/25 bg-brand-soft', icon: <Info className="size-4 text-brand" /> },
  warn: { box: 'border-warn/35 bg-warn/10', icon: <AlertTriangle className="size-4 text-warn" /> },
  ok: { box: 'border-ok/30 bg-ok/10', icon: <CheckCircle2 className="size-4 text-ok" /> },
} as const;

export function Callout({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: keyof typeof tones;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const t = tones[tone];
  return (
    <div className={cn('flex gap-3 rounded-xl border p-3.5 text-sm', t.box, className)}>
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-[13px] leading-relaxed text-muted">{children}</div>}
      </div>
    </div>
  );
}
