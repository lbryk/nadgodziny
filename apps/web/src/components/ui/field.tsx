import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export const inputClass =
  'h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/70 transition-shadow focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />;
});

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

/** Decimal-aware numeric input: accepts "2,5", commits on blur/Enter, never emits NaN. */
export function NumberField({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  className,
  suffix,
  ...props
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max' | 'step' | 'type'>) {
  const display = value === 0 && props.placeholder ? '' : String(value).replace('.', ',');
  const commit = (raw: string) => {
    const parsed = Number(raw.replace(',', '.').trim());
    if (raw.trim() === '' || Number.isNaN(parsed)) return onChange(min);
    onChange(Math.min(max, Math.max(min, Math.round(parsed * 100) / 100)));
  };
  return (
    <div className={cn('relative', className)}>
      <input
        key={display}
        inputMode="decimal"
        defaultValue={display}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const delta = e.key === 'ArrowUp' ? step : -step;
            onChange(Math.min(max, Math.max(min, Math.round((value + delta) * 100) / 100)));
          }
        }}
        className={cn(inputClass, 'num', suffix && 'pr-12')}
        {...props}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-muted">
          {suffix}
        </span>
      )}
    </div>
  );
}
