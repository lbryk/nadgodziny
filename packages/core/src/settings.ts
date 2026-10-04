import type { Settings, Voivodeship } from './types';

export const VOIVODESHIPS: { id: Voivodeship; label: string }[] = [
  { id: 'dolnoslaskie', label: 'dolnośląskie' },
  { id: 'kujawsko-pomorskie', label: 'kujawsko-pomorskie' },
  { id: 'lubelskie', label: 'lubelskie' },
  { id: 'lubuskie', label: 'lubuskie' },
  { id: 'lodzkie', label: 'łódzkie' },
  { id: 'malopolskie', label: 'małopolskie' },
  { id: 'mazowieckie', label: 'mazowieckie' },
  { id: 'opolskie', label: 'opolskie' },
  { id: 'podkarpackie', label: 'podkarpackie' },
  { id: 'podlaskie', label: 'podlaskie' },
  { id: 'pomorskie', label: 'pomorskie' },
  { id: 'slaskie', label: 'śląskie' },
  { id: 'swietokrzyskie', label: 'świętokrzyskie' },
  { id: 'warminsko-mazurskie', label: 'warmińsko-mazurskie' },
  { id: 'wielkopolskie', label: 'wielkopolskie' },
  { id: 'zachodniopomorskie', label: 'zachodniopomorskie' },
];

export const DEFAULT_SETTINGS: Settings = {
  schoolName: 'Zespół Szkół',
  schoolYearStart: 2026,
  voivodeship: 'mazowieckie',
  denIsDayOff: true,
  weights: { k12: 1, k34: 0.9, k5: 0.8, individual: 1 },
  weeksPerMonth: 4.16,
  rounding: 'nearest',
  workdaysBasis: 'working-days',
  absenceCounting: 'lesson-days',
  examDays: 'neutral',
  class5EndDate: '2027-04-30',
  pensumPresets: [18, 20, 22, 30],
  defaultPensum: 18,
  submissionDeadline: '2026-10-09T16:00',
  announcement: 'Przypominamy o zmianie planu od 5 października 2026.',
};
