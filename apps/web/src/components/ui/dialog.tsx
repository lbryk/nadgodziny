import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Dialog as RadixDialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Button } from './button';

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-[#050813]/55 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </RadixDialog.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 grid place-items-end p-0 sm:place-items-center sm:p-6">
              <RadixDialog.Content asChild aria-describedby={undefined}>
                <motion.div
                  className={cn(
                    'pointer-events-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-pop sm:max-w-xl sm:rounded-3xl',
                    className,
                  )}
                  initial={{ opacity: 0, y: 40, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 24, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                >
                  <div className="flex items-start gap-3 border-b border-line p-5">
                    <div className="min-w-0 flex-1">
                      <RadixDialog.Title className="text-lg font-semibold tracking-tight">
                        {title}
                      </RadixDialog.Title>
                      {description && (
                        <RadixDialog.Description className="mt-1 text-sm text-muted">
                          {description}
                        </RadixDialog.Description>
                      )}
                    </div>
                    <RadixDialog.Close asChild>
                      <Button variant="ghost" size="icon" aria-label="Zamknij">
                        <X className="size-4" />
                      </Button>
                    </RadixDialog.Close>
                  </div>
                  <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
                  {footer && (
                    <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2/50 p-4">
                      {footer}
                    </div>
                  )}
                </motion.div>
              </RadixDialog.Content>
            </div>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  );
}
