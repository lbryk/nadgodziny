import { BookOpenText, HelpCircle, LayoutDashboard, PlayCircle, RotateCcw } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { stepsFor } from './steps';
import { useTourStore } from './tour-store';

/** The "?" button in the header: start the tour, replay a part of it or resume where you stopped. */
export function TourMenu() {
  const [open, setOpen] = useState(false);
  const { start, seen, completed, lastIndex, lastChapter } = useTourStore();
  const canResume = lastIndex > 0 && !completed;
  const total = stepsFor(lastChapter).length;

  const run = (chapter: 'all' | 'ui' | 'rules', index = 0) => {
    setOpen(false);
    // let the popover close first so focus is not stolen back from the tour
    setTimeout(() => start(chapter, index), 80);
  };

  const item =
    'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-brand-soft focus-visible:bg-brand-soft';

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative gap-1.5 px-2.5"
          aria-label="Samouczek"
          data-tour="tour-button"
          data-testid="tour-menu"
        >
          <HelpCircle className="size-[18px]" />
          <span className="hidden text-[13px] lg:inline">Samouczek</span>
          {!seen && (
            <span className="absolute top-1 right-1 size-2 rounded-full bg-brand ring-2 ring-surface" />
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-[70] w-72 rounded-2xl border border-line bg-surface p-1.5 shadow-pop"
        >
          <p className="px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-muted uppercase">
            Samouczek
          </p>
          {canResume && (
            <button
              type="button"
              className={item}
              onClick={() => run(lastChapter, lastIndex)}
              data-testid="tour-resume"
            >
              <RotateCcw className="mt-0.5 size-4 text-brand" />
              <span>
                <b className="block font-medium">Wznów od miejsca, w którym skończyłeś</b>
                <span className="text-xs text-muted">
                  krok {lastIndex + 1} z {total}
                </span>
              </span>
            </button>
          )}
          <button
            type="button"
            className={item}
            onClick={() => run('all')}
            data-testid="tour-start"
          >
            <PlayCircle className="mt-0.5 size-4 text-brand" />
            <span>
              <b className="block font-medium">Cały samouczek od początku</b>
              <span className="text-xs text-muted">interfejs + zasady rozliczania</span>
            </span>
          </button>
          <button type="button" className={item} onClick={() => run('ui')}>
            <LayoutDashboard className="mt-0.5 size-4 text-brand" />
            <span>
              <b className="block font-medium">Tylko interfejs</b>
              <span className="text-xs text-muted">gdzie co wpisać i klikać</span>
            </span>
          </button>
          <button
            type="button"
            className={item}
            onClick={() => run('rules')}
            data-testid="tour-rules"
          >
            <BookOpenText className="mt-0.5 size-4 text-brand" />
            <span>
              <b className="block font-medium">Jak rozliczać nadgodziny</b>
              <span className="text-xs text-muted">wariant 1 i 2, nieobecności, egzaminy</span>
            </span>
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
