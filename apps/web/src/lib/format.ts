const nf2 = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const nf2fixed = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });

/** 3,83 — up to two decimals, Polish decimal comma. */
export function fmt(value: number): string {
  return nf2.format(Math.round(value * 100) / 100);
}

/** 3,50 — always two decimals. */
export function fmt2(value: number): string {
  return nf2fixed.format(value);
}

export function fmtPln(value: number): string {
  return money.format(value);
}

/** "godzina / godziny / godzin" for a number of hours. */
export function hoursWord(n: number): string {
  const v = Math.abs(n);
  if (v === 1) return 'godzina';
  if (!Number.isInteger(v)) return 'godziny';
  const last = v % 10;
  const lastTwo = v % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return 'godziny';
  return 'godzin';
}

export function daysWord(n: number): string {
  const v = Math.abs(n);
  if (v === 1) return 'dzień';
  return 'dni';
}
