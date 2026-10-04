import { eachDay, isValidISO, isWeekend, makeISO, type ISODate } from '../dates';
import type { CustomDay } from '../types';
import { inferKind, type ImportKind } from './kinds';

export interface DateCandidate extends CustomDay {
  /** The source line the date was read from — shown to the administrator for verification. */
  source: string;
}

export interface TextImportResult {
  days: DateCandidate[];
  warnings: string[];
}

const MONTHS: Record<string, number> = {
  stycznia: 1,
  styczen: 1,
  sty: 1,
  lutego: 2,
  luty: 2,
  lut: 2,
  marca: 3,
  marzec: 3,
  mar: 3,
  kwietnia: 4,
  kwiecien: 4,
  kwi: 4,
  maja: 5,
  maj: 5,
  czerwca: 6,
  czerwiec: 6,
  cze: 6,
  lipca: 7,
  lipiec: 7,
  lip: 7,
  sierpnia: 8,
  sierpien: 8,
  sie: 8,
  wrzesnia: 9,
  wrzesien: 9,
  wrz: 9,
  pazdziernika: 10,
  pazdziernik: 10,
  paz: 10,
  listopada: 11,
  listopad: 11,
  lis: 11,
  grudnia: 12,
  grudzien: 12,
  gru: 12,
};

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L');
}

/** Cleans typical OCR damage before the date patterns run. */
export function normalizeOcrText(text: string): string {
  return (
    text
      .replace(/[‐-―−]/g, '-') // dashes
      .replace(/(?<=\d)\s*[.,]\s*(?=\d{1,2}\b)/g, '.') // "14 , 10" → "14.10"
      .replace(/(?<=\d)[Oo](?=\d)/g, '0') // 2O26 → 2026
      // date-shaped tokens: letters that OCR confuses with digits (l4.1O.2O26 → 14.10.2026)
      .replace(/(?<![\w])[\dOolI|]{1,2}[./-][\dOolI|]{1,2}[./-][\dOolI|]{4}(?![\w])/g, (token) =>
        token.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1'),
      )
      .replace(/[ \t]+/g, ' ')
  );
}

interface Hit {
  from: ISODate;
  to: ISODate;
}

/**
 * Finds dates and date ranges in free text (OCR output or pasted notes).
 *
 * Recognised: `14.10.2026`, `14-10-2026`, `2026-10-14`, `14.10`, `1-14.02.2027`,
 * `01.02 - 14.02.2027`, `18-31 stycznia 2027`, `14 października`, `25 marca – 30 marca 2027`.
 * Dates without a year are placed inside the school year (Sep–Dec → start year, Jan–Aug → next).
 */
export function extractDaysFromText(
  text: string,
  options: { schoolYearStart: number; defaultKind?: ImportKind; includeWeekends?: boolean },
): TextImportResult {
  const { schoolYearStart, defaultKind = 'other', includeWeekends = false } = options;
  const warnings: string[] = [];
  const byDate = new Map<ISODate, DateCandidate>();
  const lines = normalizeOcrText(text).split(/\r?\n/);

  const yearFor = (month: number, explicit?: string): number => {
    if (explicit) return explicit.length === 2 ? 2000 + Number(explicit) : Number(explicit);
    return month >= 9 ? schoolYearStart : schoolYearStart + 1;
  };
  const iso = (y: number, m: number, d: number): ISODate | null => {
    const value = makeISO(y, m, d);
    // makeISO normalises overflow — reject dates that rolled over
    const candidate = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return value === candidate && isValidISO(candidate) ? candidate : null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const hits: Hit[] = [];
    let rest = line;

    const consume = (re: RegExp, build: (m: RegExpExecArray) => Hit | null) => {
      rest = rest.replace(re, (...args) => {
        const groups = args.slice(0, -2) as string[];
        const m = groups as unknown as RegExpExecArray;
        const hit = build(m);
        if (hit) {
          hits.push(hit);
          return ' ';
        }
        return groups[0] ?? '';
      });
    };

    // 1) 2026-10-14
    consume(/(\d{4})-(\d{2})-(\d{2})/g, (m) => {
      const d = iso(Number(m[1]), Number(m[2]), Number(m[3]));
      return d ? { from: d, to: d } : null;
    });
    // 2) 01.02.2027 - 14.02.2027
    consume(/(\d{1,2})[./](\d{1,2})[./](\d{4})\s*-\s*(\d{1,2})[./](\d{1,2})[./](\d{4})/g, (m) => {
      const a = iso(Number(m[3]), Number(m[2]), Number(m[1]));
      const b = iso(Number(m[6]), Number(m[5]), Number(m[4]));
      return a && b && a <= b ? { from: a, to: b } : null;
    });
    // 3) 01.02 - 14.02.2027  (year only at the end)
    consume(/(\d{1,2})[./](\d{1,2})\.?\s*-\s*(\d{1,2})[./](\d{1,2})[./](\d{2,4})/g, (m) => {
      const year = yearFor(Number(m[4]), m[5]);
      const startYear = Number(m[2]) > Number(m[4]) ? year - 1 : year;
      const a = iso(startYear, Number(m[2]), Number(m[1]));
      const b = iso(year, Number(m[4]), Number(m[3]));
      return a && b && a <= b ? { from: a, to: b } : null;
    });
    // 4) 1-14.02.2027 / 1-14.02
    consume(/(\d{1,2})\s*-\s*(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?!\d)/g, (m) => {
      const month = Number(m[3]);
      const year = yearFor(month, m[4]);
      const a = iso(year, month, Number(m[1]));
      const b = iso(year, month, Number(m[2]));
      return a && b && a <= b ? { from: a, to: b } : null;
    });
    // 5) 18-31 stycznia 2027  /  25 marca - 30 marca 2027
    const monthWord = '([a-ząćęłńóśźż]{3,13})';
    consume(
      new RegExp(
        `(\\d{1,2})\\s*${monthWord}?\\s*-\\s*(\\d{1,2})\\s+${monthWord}(?:\\s+(\\d{4}))?`,
        'gi',
      ),
      (m) => {
        const endMonth = MONTHS[stripDiacritics((m[4] ?? '').toLowerCase())];
        if (!endMonth) return null;
        const startMonth = m[2] ? MONTHS[stripDiacritics(m[2].toLowerCase())] : endMonth;
        if (!startMonth) return null;
        const endYear = yearFor(endMonth, m[5]);
        const startYear = startMonth > endMonth ? endYear - 1 : endYear;
        const a = iso(startYear, startMonth, Number(m[1]));
        const b = iso(endYear, endMonth, Number(m[3]));
        return a && b && a <= b ? { from: a, to: b } : null;
      },
    );
    // 6) 14.10.2026 / 14-10-2026
    consume(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/g, (m) => {
      const d = iso(Number(m[3]), Number(m[2]), Number(m[1]));
      return d ? { from: d, to: d } : null;
    });
    // 7) 14 października [2026]
    consume(new RegExp(`(\\d{1,2})\\s+${monthWord}(?:\\s+(\\d{4}))?`, 'gi'), (m) => {
      const month = MONTHS[stripDiacritics((m[2] ?? '').toLowerCase())];
      if (!month) return null;
      const d = iso(yearFor(month, m[3]), month, Number(m[1]));
      return d ? { from: d, to: d } : null;
    });
    // 8) 14.10 (no year)
    consume(/(?<![\d.])(\d{1,2})\.(\d{1,2})(?![\d.])/g, (m) => {
      const month = Number(m[2]);
      if (month < 1 || month > 12) return null;
      const d = iso(yearFor(month), month, Number(m[1]));
      return d ? { from: d, to: d } : null;
    });

    if (hits.length === 0) continue;
    const kind = inferKind(line, defaultKind);
    // what is left of the line once the dates are removed ("Ferie zimowe", "Dzień Edukacji Narodowej")
    const label =
      rest
        .replace(/[\s:;,()\-–—.]+/g, ' ')
        .trim()
        .slice(0, 120) || undefined;
    for (const hit of hits) {
      const single = hit.from === hit.to;
      for (const date of eachDay(hit.from, hit.to)) {
        if (!single && !includeWeekends && isWeekend(date)) continue;
        byDate.set(date, { date, kind, ...(label ? { label } : {}), source: line });
      }
    }
  }

  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (days.length === 0)
    warnings.push('Nie rozpoznano żadnych dat. Spróbuj wyraźniejszego zdjęcia.');
  const outOfRange = days.filter(
    (d) => d.date < makeISO(schoolYearStart, 8, 1) || d.date > makeISO(schoolYearStart + 1, 8, 31),
  );
  if (outOfRange.length) {
    warnings.push(
      `${outOfRange.length} dat leży poza rokiem szkolnym ${schoolYearStart}/${schoolYearStart + 1}.`,
    );
  }
  return { days, warnings };
}
