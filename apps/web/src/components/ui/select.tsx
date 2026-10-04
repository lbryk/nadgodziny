import { Check, ChevronDown } from 'lucide-react';
import { Select as RadixSelect } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Select<T extends string>({
  value,
  onChange,
  options,
  id,
  className,
  placeholder,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  id?: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <RadixSelect.Root value={value} onValueChange={(v) => onChange(v as T)}>
      <RadixSelect.Trigger
        id={id}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 text-left text-sm focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none',
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown className="size-4 text-muted" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          className="z-[70] max-h-72 w-(--radix-select-trigger-width) min-w-48 overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((o) => (
              <RadixSelect.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-pointer items-center rounded-lg py-2 pr-8 pl-3 text-sm outline-none select-none data-[highlighted]:bg-brand-soft data-[state=checked]:font-medium"
              >
                <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="absolute right-2.5">
                  <Check className="size-4 text-brand" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
