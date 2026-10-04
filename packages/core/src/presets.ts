import type { CustomDay, DateRange, Voivodeship } from './types';

/**
 * Ferie zimowe 2027 — official MEN timetable (three terms). Source: MEN, school year 2026/2027.
 */
const FERIE_2027_TERMS: { range: DateRange; voivodeships: Voivodeship[] }[] = [
  {
    range: { from: '2027-01-18', to: '2027-01-31' },
    voivodeships: ['podkarpackie', 'podlaskie', 'dolnoslaskie', 'lodzkie', 'slaskie', 'opolskie'],
  },
  {
    range: { from: '2027-02-01', to: '2027-02-14' },
    voivodeships: ['mazowieckie', 'pomorskie', 'swietokrzyskie', 'lubelskie'],
  },
  {
    range: { from: '2027-02-15', to: '2027-02-28' },
    voivodeships: [
      'lubuskie',
      'kujawsko-pomorskie',
      'warminsko-mazurskie',
      'wielkopolskie',
      'zachodniopomorskie',
      'malopolskie',
    ],
  },
];

/** Known ferie timetables, keyed by the calendar year in which the school year starts. */
const FERIE_BY_SCHOOL_YEAR: Record<number, { range: DateRange; voivodeships: Voivodeship[] }[]> = {
  2026: FERIE_2027_TERMS,
};

export function feriePreset(startYear: number, voivodeship: Voivodeship): DateRange | null {
  const terms = FERIE_BY_SCHOOL_YEAR[startYear];
  if (!terms) return null;
  return terms.find((t) => t.voivodeships.includes(voivodeship))?.range ?? null;
}

export function ferieTerms(startYear: number) {
  return FERIE_BY_SCHOOL_YEAR[startYear] ?? [];
}

/**
 * School-specific days taken from the settlement table of school year 2026/2027:
 * extra days off set by the headteacher and exam days (yellow cells in the table).
 */
export const DEFAULT_CUSTOM_DAYS: CustomDay[] = [
  { date: '2026-12-22', kind: 'director', label: 'Dzień wolny od zajęć (decyzja dyrektora)' },
  { date: '2027-05-28', kind: 'director', label: 'Dzień wolny od zajęć (po Bożym Ciele)' },
  { date: '2027-01-12', kind: 'exam', label: 'Egzaminy – sesja zimowa' },
  { date: '2027-05-04', kind: 'exam', label: 'Egzaminy – matura' },
  { date: '2027-05-05', kind: 'exam', label: 'Egzaminy – matura' },
  { date: '2027-05-06', kind: 'exam', label: 'Egzaminy – matura' },
  { date: '2027-05-07', kind: 'exam', label: 'Egzaminy – matura' },
  { date: '2027-06-08', kind: 'exam', label: 'Egzaminy – sesja letnia' },
  { date: '2027-06-09', kind: 'exam', label: 'Egzaminy – sesja letnia' },
  { date: '2027-06-25', kind: 'exam', label: 'Egzaminy – sesja letnia' },
];
