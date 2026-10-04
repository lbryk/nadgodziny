import { motion, type HTMLMotionProps } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, ...props }: HTMLMotionProps<'section'>) {
  return (
    <motion.section
      className={cn('rounded-card border border-line bg-surface shadow-card', className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  icon,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-start gap-3 p-5 pb-3', className)}>
      {icon && (
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-[17px] leading-tight font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-balance text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-5 pt-2', className)}>{children}</div>;
}
