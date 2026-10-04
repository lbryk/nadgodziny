import Decimal from 'decimal.js';
import type { RoundingMode } from './types';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };
export type Dec = Decimal;
export const D = (value: Decimal.Value): Decimal => new Decimal(value);
export const ZERO = new Decimal(0);

export function sum(values: Decimal.Value[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(v), ZERO);
}

/** Round a payable amount of hours to whole hours using the configured mode. */
export function roundHours(value: Decimal.Value, mode: RoundingMode): number {
  const v = D(value);
  switch (mode) {
    case 'up':
      return v.toDecimalPlaces(0, Decimal.ROUND_CEIL).toNumber();
    case 'down':
      return v.toDecimalPlaces(0, Decimal.ROUND_FLOOR).toNumber();
    default:
      return v.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  }
}

/** Display precision used everywhere (two decimals). */
export function r2(value: Decimal.Value): number {
  return D(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function clampNonNegative(value: Decimal.Value): Decimal {
  const v = D(value);
  return v.isNegative() ? ZERO : v;
}
