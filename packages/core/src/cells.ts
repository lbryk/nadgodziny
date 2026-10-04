/**
 * Cell notation used in the school's table: `3` or `3+1` — three regular hours and
 * one hour of individual teaching (written in green on paper).
 */

export interface ParsedCell {
  regular: number;
  individual: number;
}

export type CellParseResult = ({ ok: true } & ParsedCell) | { ok: false; reason: string };

const PART_RE = /^\d+(?:[.,]\d+)?$/;

export function parseCell(input: string): CellParseResult {
  const text = input.replace(/\s+/g, '');
  if (text === '') return { ok: true, regular: 0, individual: 0 };
  const parts = text.split('+');
  if (parts.length > 2) return { ok: false, reason: 'Użyj formatu „3” lub „3+1”.' };
  const numbers: number[] = [];
  for (const part of parts) {
    if (part === '') {
      numbers.push(0);
      continue;
    }
    if (!PART_RE.test(part)) return { ok: false, reason: 'Wpisz liczbę godzin, np. 3 lub 3+1.' };
    numbers.push(Number(part.replace(',', '.')));
  }
  const [regular = 0, individual = 0] = numbers;
  if (regular > 24 || individual > 24) return { ok: false, reason: 'Maksymalnie 24 godziny.' };
  return { ok: true, regular, individual };
}

export function formatCell(regular: number, individual: number): string {
  const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
  if (individual > 0) return `${fmt(regular)}+${fmt(individual)}`;
  return regular === 0 ? '' : fmt(regular);
}
