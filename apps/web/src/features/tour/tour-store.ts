import { create } from 'zustand';
import { safeStorage } from '../../lib/safe-storage';

export type TourChapter = 'all' | 'ui' | 'rules';

const KEY = 'nadgodziny:tour:v1';

interface Saved {
  /** The tour has been offered once — it never starts by itself again. */
  seen: boolean;
  completed: boolean;
  /** Where the user stopped, to offer "resume". */
  lastChapter: TourChapter;
  lastIndex: number;
}

const initial: Saved = { seen: false, completed: false, lastChapter: 'all', lastIndex: 0 };

function load(): Saved {
  try {
    const raw = safeStorage.getItem(KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as Partial<Saved>;
    return {
      seen: parsed.seen === true,
      completed: parsed.completed === true,
      lastChapter:
        parsed.lastChapter === 'ui' || parsed.lastChapter === 'rules' ? parsed.lastChapter : 'all',
      lastIndex: Number.isInteger(parsed.lastIndex) ? Math.max(0, parsed.lastIndex!) : 0,
    };
  } catch {
    return initial;
  }
}

interface TourState extends Saved {
  open: boolean;
  chapter: TourChapter;
  index: number;
  start: (chapter?: TourChapter, index?: number) => void;
  go: (index: number) => void;
  setChapter: (chapter: TourChapter) => void;
  /** Closes the tour; `finished` marks it as completed (last step). */
  close: (finished?: boolean) => void;
  markSeen: () => void;
}

const persist = (s: Saved) => safeStorage.setItem(KEY, JSON.stringify(s));
const pick = (s: TourState): Saved => ({
  seen: s.seen,
  completed: s.completed,
  lastChapter: s.lastChapter,
  lastIndex: s.lastIndex,
});

export const useTourStore = create<TourState>((set, get) => ({
  ...load(),
  open: false,
  chapter: 'all',
  index: 0,

  start: (chapter = 'all', index = 0) => {
    set({ open: true, chapter, index, seen: true });
    persist(pick(get()));
  },

  go: (index) => {
    set({ index, lastIndex: index, lastChapter: get().chapter });
    persist(pick(get()));
  },

  setChapter: (chapter) => {
    set({ chapter, index: 0, lastIndex: 0, lastChapter: chapter });
    persist(pick(get()));
  },

  close: (finished = false) => {
    const s = get();
    set({
      open: false,
      seen: true,
      completed: finished || s.completed,
      lastIndex: finished ? 0 : s.index,
      lastChapter: s.chapter,
    });
    persist(pick(get()));
  },

  markSeen: () => {
    set({ seen: true });
    persist(pick(get()));
  },
}));
