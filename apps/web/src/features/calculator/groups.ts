import type { GroupId, Weights } from '@nadgodziny/core';

export type RowId = GroupId | 'ind';

export const ROWS: { id: RowId; label: string; short: string; weightKey: keyof Weights; dot: string }[] = [
  { id: 'k12', label: 'Klasy 1–2', short: 'kl. 1–2', weightKey: 'k12', dot: 'bg-indigo-500' },
  { id: 'k34', label: 'Klasy 3–4', short: 'kl. 3–4', weightKey: 'k34', dot: 'bg-sky-500' },
  { id: 'k5', label: 'Klasy 5', short: 'kl. 5', weightKey: 'k5', dot: 'bg-amber-500' },
  { id: 'ind', label: 'Nauczanie indywidualne', short: 'indyw.', weightKey: 'individual', dot: 'bg-green-600' },
];

export const GROUP_LABEL: Record<GroupId, string> = {
  k12: 'klasy 1–2',
  k34: 'klasy 3–4',
  k5: 'klasy 5',
};

/** Spread a weekly total over five days in half-hour units, earlier days first. */
export function distribute(total: number): number[] {
  const units = Math.max(0, Math.round(total * 2));
  const base = Math.floor(units / 5);
  const extra = units % 5;
  return Array.from({ length: 5 }, (_, i) => (base + (i < extra ? 1 : 0)) / 2);
}
