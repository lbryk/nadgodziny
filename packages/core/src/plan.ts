import { emptyTimetable } from './engine';
import type { EventKind, Settings, TeacherEvent, TeacherPlan } from './types';

export function createDefaultPlan(settings: Pick<Settings, 'defaultPensum'>): TeacherPlan {
  return {
    teacherName: '',
    variant: 1,
    pensumFull: settings.defaultPensum,
    contractHours: settings.defaultPensum,
    individualInPensum: false,
    timetable: emptyTimetable(),
    cellOverrides: {},
    events: [],
    monthly: {},
    avgPensumOverride: null,
    hourlyRate: null,
  };
}

export interface EventKindMeta {
  label: string;
  hint: string;
  defaults: Pick<TeacherEvent, 'lessons' | 'settlement'>;
}

export const EVENT_KIND_META: Record<EventKind, EventKindMeta> = {
  trip: {
    label: 'Wycieczka',
    hint: 'Zajęcia w tym dniu nie odbywają się — godziny są odliczane. Rozliczenie wycieczki jest odrębne.',
    defaults: { lessons: 'whole-day', settlement: 'separate' },
  },
  training: {
    label: 'Szkolenie / delegacja',
    hint: 'Nieobecność na zajęciach — godziny są odliczane.',
    defaults: { lessons: 'whole-day', settlement: 'none' },
  },
  absence: {
    label: 'Nieobecność (L4, urlop)',
    hint: 'Nieobecność w danym miesiącu zmniejsza nadgodziny proporcjonalnie do liczby dni.',
    defaults: { lessons: 'whole-day', settlement: 'none' },
  },
  practice: {
    label: 'Praktyki uczniowskie',
    hint: 'Godziny wybranych klas znikają z rozkładu na czas praktyk (domyślnie klasy 3–4).',
    defaults: { lessons: 'groups', settlement: 'none' },
  },
  'exam-oral': {
    label: 'Egzamin ustny',
    hint: 'Egzaminy ustne są rozliczane odrębnie — wpisz liczbę godzin do wypłaty.',
    defaults: { lessons: 'whole-day', settlement: 'separate' },
  },
  'exam-assist': {
    label: 'Asystent / operator egzaminu',
    hint: 'Pełnienie funkcji asystenta lub operatora jest rozliczane odrębnie.',
    defaults: { lessons: 'whole-day', settlement: 'separate' },
  },
  substitution: {
    label: 'Zastępstwo',
    hint: 'Zastępstwa dodawane są oddzielnie. Zastępstwo w okienku (w ramach 40 h tygodnia pracy) nie jest płatne.',
    defaults: { lessons: 'none', settlement: 'separate' },
  },
  individual: {
    label: 'Nauczanie indywidualne (dodatkowe)',
    hint: 'Płatne tylko za godziny faktycznie przepracowane — z tematem i frekwencją w dzienniku ucznia.',
    defaults: { lessons: 'none', settlement: 'separate' },
  },
  other: {
    label: 'Inne wydarzenie',
    hint: 'Dowolne wydarzenie, które wpływa na przydział godzin.',
    defaults: { lessons: 'none', settlement: 'none' },
  },
};

export function createEvent(id: string, kind: EventKind, date: string): TeacherEvent {
  const meta = EVENT_KIND_META[kind];
  return {
    id,
    kind,
    title: meta.label,
    from: date,
    to: date,
    lessons: meta.defaults.lessons,
    hoursPerDay: 1,
    groups: kind === 'practice' ? ['k34'] : [],
    settlement: meta.defaults.settlement,
    paidHours: 0,
    note: '',
  };
}
