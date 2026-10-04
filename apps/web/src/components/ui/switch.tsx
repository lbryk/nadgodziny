import { Switch as RadixSwitch } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Toggle({
  checked,
  onChange,
  label,
  description,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', className)}>
      <RadixSwitch.Root
        checked={checked}
        onCheckedChange={onChange}
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-line transition-colors data-[state=checked]:bg-brand"
      >
        <RadixSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
      </RadixSwitch.Root>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
    </label>
  );
}
