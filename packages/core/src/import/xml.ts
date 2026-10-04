import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { addDays, eachDay, isValidISO, isWeekend, type ISODate } from '../dates';
import type { CustomDay } from '../types';
import { kindFromAttribute } from './kinds';

export interface ImportResult {
  days: CustomDay[];
  warnings: string[];
}

const MAX_RANGE_DAYS = 400;

/** Accepts `2026-10-14`, `14.10.2026`, `14/10/2026`, `14-10-2026`. */
export function normalizeDateString(value: unknown): ISODate | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (isValidISO(v)) return v;
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(v);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return isValidISO(iso) ? iso : null;
}

type Node = Record<string, unknown>;

const DAY_TAGS = new Set(['dzien', 'dzień', 'day']);
const RANGE_TAGS = new Set(['zakres', 'okres', 'range']);

function attr(node: Node, ...names: string[]): unknown {
  for (const n of names) {
    const v = node[`@_${n}`];
    if (v !== undefined) return v;
  }
  return undefined;
}

function textOf(node: Node): string | undefined {
  const t = node['#text'];
  return typeof t === 'string' && t.trim() ? t.trim() : undefined;
}

function collect(node: unknown, out: { tag: string; node: Node }[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collect(item, out);
    return;
  }
  if (typeof node !== 'object' || node === null) return;
  for (const [key, value] of Object.entries(node as Node)) {
    if (key.startsWith('@_') || key === '#text') continue;
    const lower = key.toLowerCase();
    if (DAY_TAGS.has(lower) || RANGE_TAGS.has(lower)) {
      const list = Array.isArray(value) ? value : [value];
      for (const item of list) {
        out.push({ tag: lower, node: (typeof item === 'object' && item ? item : {}) as Node });
      }
    } else {
      collect(value, out);
    }
  }
}

/**
 * Parses an administrator-supplied calendar file:
 *
 *   <kalendarz rok="2026/2027">
 *     <dzien data="2026-10-14" typ="den" nazwa="Dzień Edukacji Narodowej"/>
 *     <zakres od="2027-02-01" do="2027-02-14" typ="ferie" nazwa="Ferie zimowe"/>
 *   </kalendarz>
 *
 * English element/attribute names (`day`, `range`, `date`, `from`, `to`, `type`, `name`) and
 * Polish type names are both accepted. Weekends inside ranges are skipped.
 */
export function parseCalendarXml(xml: string): ImportResult {
  const warnings: string[] = [];
  const valid = XMLValidator.validate(xml);
  if (valid !== true) {
    throw new Error(`Niepoprawny plik XML: ${valid.err.msg} (linia ${valid.err.line})`);
  }
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', trimValues: true });
  const tree = parser.parse(xml) as unknown;
  const nodes: { tag: string; node: Node }[] = [];
  collect(tree, nodes);

  const byDate = new Map<ISODate, CustomDay>();
  for (const { tag, node } of nodes) {
    const kind = kindFromAttribute(attr(node, 'typ', 'type', 'rodzaj'), 'other');
    const label = String(attr(node, 'nazwa', 'name', 'opis') ?? textOf(node) ?? '').trim() || undefined;
    if (DAY_TAGS.has(tag)) {
      const date = normalizeDateString(attr(node, 'data', 'date'));
      if (!date) {
        warnings.push(`Pominięto wpis bez poprawnej daty: ${JSON.stringify(node)}`);
        continue;
      }
      byDate.set(date, { date, kind, ...(label ? { label } : {}) });
    } else {
      const from = normalizeDateString(attr(node, 'od', 'from'));
      const to = normalizeDateString(attr(node, 'do', 'to'));
      if (!from || !to || to < from) {
        warnings.push(`Pominięto zakres z niepoprawnymi datami: ${JSON.stringify(node)}`);
        continue;
      }
      if (eachDay(from, to).length > MAX_RANGE_DAYS) {
        warnings.push(`Zakres ${from} – ${to} jest za długi (maks. ${MAX_RANGE_DAYS} dni).`);
        continue;
      }
      for (const date of eachDay(from, to)) {
        if (isWeekend(date)) continue;
        byDate.set(date, { date, kind, ...(label ? { label } : {}) });
      }
    }
  }

  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (days.length === 0) warnings.push('Nie znaleziono żadnych dni w pliku XML.');
  return { days, warnings };
}

/** Serialises days to the same XML format (consecutive same-kind days are folded into ranges). */
export function buildCalendarXml(days: CustomDay[], schoolYear?: string): string {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const entries: Record<string, string>[] = [];
  let i = 0;
  while (i < sorted.length) {
    const first = sorted[i]!;
    let last = first;
    let j = i + 1;
    while (j < sorted.length) {
      const next = sorted[j]!;
      const sameLabel = next.kind === first.kind && (next.label ?? '') === (first.label ?? '');
      if (!sameLabel) break;
      // allow a weekend gap when folding (ranges skip weekends on import)
      let gap = addDays(last.date, 1);
      while (isWeekend(gap)) gap = addDays(gap, 1);
      if (next.date !== gap) break;
      last = next;
      j += 1;
    }
    entries.push(
      last === first
        ? { '@_data': first.date, '@_typ': first.kind, ...(first.label ? { '@_nazwa': first.label } : {}) }
        : {
            '@_od': first.date,
            '@_do': last.date,
            '@_typ': first.kind,
            ...(first.label ? { '@_nazwa': first.label } : {}),
          },
    );
    i = j;
  }
  const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_', format: true });
  const single = entries.filter((e) => '@_data' in e);
  const ranges = entries.filter((e) => '@_od' in e);
  const body = builder.build({
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    kalendarz: {
      ...(schoolYear ? { '@_rok': schoolYear } : {}),
      ...(single.length ? { dzien: single } : {}),
      ...(ranges.length ? { zakres: ranges } : {}),
    },
  });
  return String(body);
}
