import { roundHours, variant1Core, variant1Deduction } from '@nadgodziny/core';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  BookOpenText,
  Calculator,
  CalendarDays,
  CalendarPlus,
  FileDown,
  GraduationCap,
  HelpCircle,
  Layers,
  ListChecks,
  Navigation,
  PartyPopper,
  Percent,
  ScanText,
  Scale,
  Sigma,
  Sparkles,
  UserRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useCalc } from '../../hooks/calc-context';
import { fmt, fmt2 } from '../../lib/format';
import { useTourStore } from './tour-store';

export type Placement = 'auto' | 'top' | 'bottom' | 'left' | 'right';

export interface TourStep {
  id: string;
  chapter: 'ui' | 'rules';
  title: string;
  icon: LucideIcon;
  /** CSS selector of the element to highlight; omitted → centred card. */
  target?: string;
  /** Page (path + search) the step needs; the tour navigates there. */
  route?: string;
  placement?: Placement;
  body: () => ReactNode;
}

/* ---------------------------------------------------------------------------------------------
 * Small typographic helpers
 * ------------------------------------------------------------------------------------------- */

const P = ({ children }: { children: ReactNode }) => <p className="leading-relaxed">{children}</p>;

const Ul = ({ children }: { children: ReactNode }) => (
  <ul className="list-disc space-y-1.5 pl-5 marker:text-brand">{children}</ul>
);

const Formula = ({ children }: { children: ReactNode }) => (
  <div className="num rounded-xl bg-surface-2 px-3 py-2.5 font-mono text-[12.5px] leading-relaxed">
    {children}
  </div>
);

const Note = ({ children }: { children: ReactNode }) => (
  <p className="rounded-xl border border-brand/25 bg-brand-soft px-3 py-2 text-[13px] leading-relaxed">
    {children}
  </p>
);

const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">
    {children}
  </kbd>
);

/** "9 października 2026 o 16:00" from the admin-set deadline. */
function useDeadline() {
  const { settings } = useCalc();
  if (!settings.submissionDeadline)
    return { text: 'terminu wyznaczonego przez dyrektora', days: null as number | null };
  const date = parseISO(settings.submissionDeadline);
  if (Number.isNaN(date.getTime()))
    return { text: 'terminu wyznaczonego przez dyrektora', days: null };
  return {
    text: format(date, "d MMMM yyyy 'do godz.' HH:mm", { locale: pl }),
    days: differenceInCalendarDays(date, new Date()),
  };
}

/* ---------------------------------------------------------------------------------------------
 * Part 1 — the interface
 * ------------------------------------------------------------------------------------------- */

function Welcome() {
  return (
    <div className="space-y-3">
      <P>
        Pokażemy Ci krok po kroku, jak działa kalkulator — a potem jak <b>według zasad dyrektora</b>{' '}
        rozlicza się nadgodziny.
      </P>
      <Ul>
        <li>
          <b>Część 1 — interfejs</b> (ok. 2 minut): gdzie co wpisać i co się dzieje z wynikiem.
        </li>
        <li>
          <b>Część 2 — rozliczanie nadgodzin</b>: wariant 1 i 2, nieobecności, wycieczki, egzaminy,
          klasy 5.
        </li>
      </Ul>
      <Note>
        Samouczek możesz <b>zamknąć w dowolnym momencie</b> (✕ albo <Kbd>Esc</Kbd>) i wrócić do
        niego przyciskiem <b>?</b> w nagłówku — także od wybranego miejsca.
      </Note>
    </div>
  );
}

const UI_STEPS: TourStep[] = [
  {
    id: 'welcome',
    chapter: 'ui',
    title: 'Witaj w kalkulatorze nadgodzin',
    icon: Sparkles,
    body: Welcome,
  },
  {
    id: 'nav',
    chapter: 'ui',
    title: 'Menu główne',
    icon: Navigation,
    target: '[data-tour="nav"]',
    route: '/',
    placement: 'bottom',
    body: () => (
      <Ul>
        <li>
          <b>Kalkulator</b> — tu wpisujesz godziny i widzisz wynik.
        </li>
        <li>
          <b>Kalendarz</b> — rok szkolny z feriami, świętami, dniami wolnymi i egzaminami.
        </li>
        <li>
          <b>Zasady</b> — opis obu wariantów i przykład dyrektora do przeliczenia na żywo.
        </li>
      </Ul>
    ),
  },
  {
    id: 'steps',
    chapter: 'ui',
    title: 'Pięć kroków kalkulatora',
    icon: Layers,
    target: '[data-tour="steps"]',
    route: '/',
    placement: 'bottom',
    body: () => (
      <div className="space-y-2">
        <P>
          <b>1 Dane → 2 Przydział → 3 Tabela tygodniowa → 4 Wydarzenia → 5 Wynik.</b> Możesz
          swobodnie przeskakiwać między krokami — wyniki liczą się na bieżąco.
        </P>
        <P>
          Wszystko zapisuje się automatycznie <b>w tej przeglądarce</b>. Konto nie jest potrzebne.
        </P>
      </div>
    ),
  },
  {
    id: 'pensum',
    chapter: 'ui',
    title: 'Krok 1 — pensum i etat',
    icon: UserRound,
    target: '[data-tour="pensum"]',
    route: '/',
    placement: 'bottom',
    body: () => (
      <div className="space-y-2">
        <P>
          Wybierz <b>pensum</b> dla swojego zatrudnienia (18, 20, 22, 30 lub inne) i{' '}
          <b>wymiar etatu</b>: pełny, 3/4, 1/2, 1/4 albo dowolną liczbę godzin.
        </P>
        <P>
          Nadgodziny liczą się ponad ten wymiar — zmiana etatu od razu przelicza wszystkie wyniki.
        </P>
      </div>
    ),
  },
  {
    id: 'variant',
    chapter: 'ui',
    title: 'Wariant 1 czy wariant 2?',
    icon: Scale,
    target: '[data-tour="variant"]',
    route: '/',
    placement: 'top',
    body: () => (
      <div className="space-y-2">
        <P>
          <b>Wariant 1</b> — nadgodziny uśrednione, takie same co miesiąc. <b>Wariant 2</b> — według
          realnego przydziału z tabeli tygodniowej.
        </P>
        <P>
          Nie musisz zgadywać: kalkulator liczy <b>oba</b> i na końcu pokazuje różnicę.
        </P>
      </div>
    ),
  },
  {
    id: 'timetable',
    chapter: 'ui',
    title: 'Krok 2 — przydział godzin',
    icon: Calculator,
    target: '[data-tour="timetable"]',
    route: '/?krok=przydzial',
    placement: 'top',
    body: () => (
      <div className="space-y-2">
        <P>
          Wpisz godziny w każdym dniu — osobno dla <b>klas 1–2, 3–4, 5</b> i{' '}
          <b>nauczania indywidualnego</b> (zielone).
        </P>
        <P>
          Wpisz sumę w kolumnie <b>„Razem”</b>, a rozłożymy ją równo na dni. Klawisze <Kbd>↑</Kbd>{' '}
          <Kbd>↓</Kbd> zmieniają wartość o 1. Przy każdej zmianie zobaczysz zielony <b>+</b> albo
          czerwony <b>−</b>.
        </P>
      </div>
    ),
  },
  {
    id: 'plan-import',
    chapter: 'ui',
    title: 'Wczytaj godziny z planu lekcji',
    icon: ScanText,
    target: '[data-tour="plan-import"]',
    route: '/?krok=przydzial',
    placement: 'bottom',
    body: () => (
      <div className="space-y-2">
        <P>
          Nie chcesz przepisywać? Wczytaj <b>zdjęcie lub zrzut ekranu</b> z dziennika (też{' '}
          <Kbd>Ctrl</Kbd>+<Kbd>V</Kbd>), <b>PDF</b> albo plik <b>Word</b>.
        </P>
        <P>
          <b>Zdjęcie jednego dnia wystarczy</b> — godziny z tego dnia zostaną zsumowane. Plan
          tygodniowy rozdzieli się na Pn–Pt sam. Przed zapisem możesz poprawić każdą lekcję.
        </P>
      </div>
    ),
  },
  {
    id: 'result-card',
    chapter: 'ui',
    title: 'Wynik na żywo',
    icon: Sparkles,
    target: '[data-tour="result-card"]',
    route: '/?krok=przydzial',
    placement: 'left',
    body: () => (
      <div className="space-y-2">
        <P>
          Tu widzisz <b>nadgodziny w roku</b>, rozkład na miesiące, pensum i godziny ważone.
          Przełącznik <b>Wariant 1 / 2</b> zmienia sposób liczenia.
        </P>
        <P>Przycisk na dole przenosi do pełnego rozliczenia i pobierania.</P>
      </div>
    ),
  },
  {
    id: 'weekly-table',
    chapter: 'ui',
    title: 'Krok 3 — tabela tygodniowa',
    icon: CalendarDays,
    target: '#m-2026-09',
    route: '/?krok=tabela',
    placement: 'top',
    body: () => (
      <div className="space-y-2">
        <P>
          To tabela szkoły na <b>prawdziwym kalendarzu</b>: <b>szare</b> dni to święta, przerwy i
          ferie, <b>żółte</b> — egzaminy (nadgodziny niepłatne).
        </P>
        <P>
          Godziny wypełniły się z przydziału (bez klas 5 po 30 kwietnia, praktyk i wydarzeń).
          Kliknij komórkę i wpisz własną wartość — np. <b>3</b> albo <b>3+1</b> (3 godz. i 1
          indywidualna). Gumka zeruje cały tydzień.
        </P>
      </div>
    ),
  },
  {
    id: 'avg-pensum',
    chapter: 'ui',
    title: 'Pensum uśrednione',
    icon: Sigma,
    target: '[data-tour="avg-pensum"]',
    route: '/?krok=tabela',
    placement: 'bottom',
    body: () => (
      <div className="space-y-2">
        <P>
          Pensum trzeba wypracować <b>średnio w całym roku</b>. Dopiero godziny powyżej uśrednionego
          progu są ponadwymiarowe — dlatego bywa to np. 21, a nie 18.
        </P>
        <P>Kalkulator liczy ten próg sam; możesz też wpisać własny.</P>
      </div>
    ),
  },
  {
    id: 'events',
    chapter: 'ui',
    title: 'Krok 4 — wycieczki i inne wydarzenia',
    icon: CalendarPlus,
    target: '[data-tour="event-form"]',
    route: '/?krok=wydarzenia',
    placement: 'right',
    body: () => (
      <div className="space-y-2">
        <P>
          Dodaj <b>wycieczkę, szkolenie, nieobecność, praktyki, egzamin ustny, zastępstwo</b>… Wskaż
          daty, wpływ na zajęcia (cały dzień, część, wybrane klasy) i czy rozliczenie jest odrębne.
        </P>
        <P>U dołu formularza od razu widać, o ile zmieni się wynik w obu wariantach.</P>
      </div>
    ),
  },
  {
    id: 'export',
    chapter: 'ui',
    title: 'Krok 5 — wynik i pobieranie',
    icon: FileDown,
    target: '[data-tour="export-buttons"]',
    route: '/?krok=wynik',
    placement: 'bottom',
    body: function Export() {
      const deadline = useDeadline();
      return (
        <div className="space-y-2">
          <P>
            Pobierz rozliczenie jako <b>PDF, Word lub Excel</b> (z formułami) albo wydrukuj je w
            układzie tabeli szkoły. Zaznacz, co ma zawierać dokument.
          </P>
          <P>
            Kopię roboczą (JSON) zapiszesz i wczytasz na innym komputerze. Gotowy plik wyślij
            dyrektorowi dziennikiem do <b>{deadline.text}</b>.
          </P>
        </div>
      );
    },
  },
  {
    id: 'calendar',
    chapter: 'ui',
    title: 'Kalendarz roku szkolnego',
    icon: CalendarDays,
    target: '[data-tour="calendar-legend"]',
    route: '/kalendarz',
    placement: 'bottom',
    body: () => (
      <div className="space-y-2">
        <P>
          Z tego kalendarza korzysta tabela. Kliknij rodzaj dnia, aby przefiltrować listę dni
          wolnych poniżej.
        </P>
        <P>
          Kalendarz aktualizuje <b>administrator</b> (np. gdy dyrektor ogłosi dodatkowy dzień wolny)
          — Twoja tabela zmienia się sama. Przycisk <b>.ics</b> dodaje terminy do kalendarza w
          telefonie.
        </P>
      </div>
    ),
  },
  {
    id: 'help',
    chapter: 'ui',
    title: 'Samouczek zawsze pod ręką',
    icon: HelpCircle,
    target: '[data-tour="tour-button"]',
    route: '/',
    placement: 'bottom',
    body: () => (
      <div className="space-y-2">
        <P>
          Ten przycisk uruchomi samouczek ponownie — od początku, tylko część o interfejsie albo
          tylko zasady rozliczania. Jeśli zamkniesz go w trakcie, wznowisz od tego samego miejsca.
        </P>
        <Note>
          Teraz najważniejsze: <b>jak rozliczać nadgodziny</b>. Kliknij „Dalej”.
        </Note>
      </div>
    ),
  },
];

/* ---------------------------------------------------------------------------------------------
 * Part 2 — how overtime is settled (from the director's message and the school's table)
 * ------------------------------------------------------------------------------------------- */

function RBasics() {
  const { settings } = useCalc();
  return (
    <div className="space-y-3">
      <Ul>
        <li>
          <b>Nadgodziny</b> to godziny ponad pensum ({settings.pensumPresets.join(' / ')} zależnie
          od zatrudnienia; przy niepełnym etacie — ponad wymiar z umowy).
        </li>
        <li>
          Do liczenia stosuje się <b>wymiar nauczycielski</b>, nie uczniowski: 25 godzin
          „uczniowskich” z klas 1–5 to mniej niż 25 godzin nauczycielskich.
        </li>
        <li>
          <b>Księgowość rozlicza PEŁNE miesiące</b> — dlatego tydzień na granicy miesięcy jest w
          tabeli podzielony.
        </li>
        <li>
          Płacone są tylko godziny <b>faktycznie przepracowane</b> — z tematem i frekwencją w
          dzienniku ucznia.
        </li>
      </Ul>
      <Note>
        Przypomnienie: zmiana planu obowiązuje od <b>5 października 2026</b>.
      </Note>
    </div>
  );
}

function RVariant1() {
  const { settings } = useCalc();
  const core = variant1Core('21.83', 18, settings.weeksPerMonth);
  const monthly = roundHours(core.monthlyRaw, settings.rounding);
  return (
    <div className="space-y-3">
      <P>
        Od lat stosowany system godzin uśrednionych. Tylko godziny w <b>klasach 1 i 2</b> ważą „1”;
        godzina w klasach 3 i 4 waży ok. <b>{fmt(settings.weights.k34)}</b>, a w klasach 5 ok.{' '}
        <b>{fmt(settings.weights.k5)}</b>.
      </P>
      <Formula>
        przydział 25 godz. uczniowskich → waga <b>21,83</b> godz. nauczycielskich
        <br />
        21,83 − 18 = <b>{fmt2(core.weeklyOvertime)}</b> godz. ponadwymiarowych / tydzień
        <br />
        {fmt2(core.weeklyOvertime)} × {fmt2(settings.weeksPerMonth)} = {fmt2(core.monthlyRaw)} →{' '}
        <b>{monthly} godz. / miesiąc</b>
      </Formula>
      <P>
        W tym wariancie — czy pracuje się więcej czy mniej — dostaje się{' '}
        <b>uśrednione nadgodziny zawsze</b>.
      </P>
    </div>
  );
}

function RAbsence() {
  const { settings } = useCalc();
  const core = variant1Core('21.83', 18, settings.weeksPerMonth);
  const monthly = roundHours(core.monthlyRaw, settings.rounding);
  const ded = variant1Deduction(monthly, 22, 3, settings.rounding);
  return (
    <div className="space-y-3">
      <P>
        Jeżeli jesteś nieobecny w danym miesiącu, np. <b>3 dni</b>, odejmuje się proporcjonalnie
        (wrzesień 2026 ma 22 dni robocze):
      </P>
      <Formula>
        {monthly} : 22 = {fmt2(ded.perDay)}
        <br />
        {fmt2(ded.perDay)} × 3 = {fmt2(ded.deductionRaw)} → {ded.deduction}
        <br />
        {monthly} − {ded.deduction} = <b>{monthly - ded.deduction} godz. do wypłaty</b>
      </Formula>
      <Ul>
        <li>
          <b>Zastępstwa</b> są dodawane oddzielnie.
        </li>
        <li>
          <b>Nauczanie indywidualne</b> też rozlicza się oddzielnie i tylko za zajęcia faktycznie
          odbyte.
        </li>
        <li>
          Przy niepełnym etacie z „indywidualnym” w wymiarze trzeba wypracować dokładnie tyle
          godzin, ile wypłacono z góry; nieodbyte odpracowuje się w kolejnym miesiącu.
        </li>
      </Ul>
    </div>
  );
}

function RClass5() {
  const { settings } = useCalc();
  return (
    <div className="space-y-3">
      <Note>
        <b>Zajęcia zawodowe w klasach 5</b> są realizowane do Bożego Narodzenia w podwojonej
        liczbie, ale płacone w „pojedynczej” — wynagrodzenie jest wypłacane przez kolejne miesiące i
        nie ustaje 1.01.2027.
      </Note>
      <Ul>
        <li>
          Przy <b>językach i matematyce</b> w klasach 5 jest podobnie, tyle że do świąt godzin jest
          mniej, a po 1 stycznia więcej.
        </li>
        <li>
          <b>Wariant 1:</b> wpisz liczbę „pojedynczą”. <b>Wariant 2:</b> wpisz realny rozkład w
          tabeli.
        </li>
        <li>
          Klasy 5 uczą się do <b>{settings.class5EndDate.split('-').reverse().join('.')}</b>{' '}
          włącznie — w maju i czerwcu godziny odejmujesz (kalkulator robi to automatycznie).
        </li>
      </Ul>
    </div>
  );
}

function RVariant2() {
  return (
    <div className="space-y-3">
      <P>
        Dla chcących mieć płacone „realne” przydziały z danego miesiąca. Wypełniasz tabelę z
        rozpisaniem na tygodnie — <b>od 1.09.2026 do 25.06.2027</b> — zliczasz wszystkie realne
        godziny i odnosisz je do pensum.
      </P>
      <Ul>
        <li>
          Klasy 3–4 mają praktyki w różnych miesiącach, a klasy 5 kończą w kwietniu — z 25 godzin
          możesz zrobić 15.
        </li>
        <li>
          Żeby wypracować pensum 18 na tydzień, w pewnych okresach trzeba pracować np.{' '}
          <b>21 godz.</b> — <b>dopiero godziny powyżej tych „21” są ponadwymiarowe</b>. To{' '}
          <b>pensum uśrednione</b>; kalkulator liczy je za Ciebie.
        </li>
        <li>
          Tylko nauczyciele z klasami 1–2 mają 18. Reszta: 19, 20, 21 i więcej. Dotyczy to także
          niepełnych etatów.
        </li>
        <li>
          Godziny, które znikną przez praktyki, trzeba <b>wypracować wcześniej</b>, żeby w miesiącu
          z praktyką mieć zapłaconą podstawę i ewentualne nadgodziny.
        </li>
      </Ul>
    </div>
  );
}

function RAbsence2() {
  return (
    <Ul>
      <li>
        <b>Nieobecność</b> (wycieczka, szkolenie, inne) to <b>niezrealizowane zajęcia</b> —
        odliczamy je. Dodaj je w kroku „Wydarzenia”.
      </li>
      <li>
        Rozliczenia za <b>wycieczki</b> są odrębnym tematem.
      </li>
      <li>
        <b>Dyrektor nie płaci podwójnie</b> za tę samą godzinę: gdy jeden nauczyciel jest na
        wycieczce, a inny z okienkiem go zastępuje, płacone ma tylko jeden z nich — zastępujący
        realizuje zajęcia w ramach 40 godz. tygodnia pracy (oznacz zastępstwo „w okienku”).
      </li>
      <li>
        W <b>dni egzaminów</b> nadgodziny nie są płacone (żółte w tabeli) — to obowiązek w ramach
        podstawowego wynagrodzenia. Wyjątek: <b>egzaminy ustne</b> i funkcja{' '}
        <b>asystenta/operatora</b> rozliczane odrębnie.
      </li>
      <li>
        Godziny <b>indywidualne</b> zapisuj na zielono: <b>3+1</b> (3 godz. przedmiotu i 1
        indywidualna).
      </li>
    </Ul>
  );
}

function RCompare() {
  return (
    <div className="space-y-3">
      <P>
        Nie uczycie w szkole podstawowej, gdzie przydział z września równa się temu z czerwca —{' '}
        <b>uśrednianie takie czy inne jest NIEUNIKNIONE</b>.
      </P>
      <Ul>
        <li>
          <b>Wariant 1</b>: prosto i stale co miesiąc, wagi uwzględniają praktyki i koniec klas 5.
        </li>
        <li>
          <b>Wariant 2</b>: odzwierciedla realne tygodnie, ale wymaga tabeli i uśredniania pensum.
        </li>
      </Ul>
      <Note>
        W kroku „Wynik” kalkulator pokazuje <b>oba warianty obok siebie</b> — porównaj liczbę godzin
        i zdecyduj. Ostateczne rozliczenie zatwierdza dyrektor.
      </Note>
    </div>
  );
}

function RDeadline() {
  const deadline = useDeadline();
  const finish = useTourStore((s) => s.close);
  return (
    <div className="space-y-3">
      <ol className="list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-brand">
        <li>Wpisz przydział (albo wczytaj plan lekcji ze zdjęcia, PDF-a lub Worda).</li>
        <li>Dodaj wydarzenia: praktyki, wycieczki, szkolenia, nieobecności, zastępstwa.</li>
        <li>Sprawdź tabelę tygodniową i porównaj oba warianty.</li>
        <li>
          Pobierz <b>PDF, Word lub Excel</b> i prześlij dyrektorowi przez dziennik do{' '}
          <b>{deadline.text}</b>
          {deadline.days !== null && deadline.days >= 0 && (
            <>
              {' '}
              (za {deadline.days} {deadline.days === 1 ? 'dzień' : 'dni'})
            </>
          )}
          .
        </li>
      </ol>
      <P>
        Z tych ustaleń rozliczenie nadgodzin zajmuje dyrektorowi dni, nie godziny — dokładne
        wypełnienie bardzo pomaga.
      </P>
      <Link
        to="/zasady"
        onClick={() => finish(true)}
        className="inline-flex items-center gap-2 text-sm font-medium text-brand underline-offset-4 hover:underline"
      >
        <BookOpenText className="size-4" /> Otwórz stronę „Zasady” z przykładem do przeliczenia
      </Link>
    </div>
  );
}

const RULES_STEPS: TourStep[] = [
  {
    id: 'r-basics',
    chapter: 'rules',
    title: 'Podstawy rozliczania',
    icon: GraduationCap,
    route: '/',
    body: RBasics,
  },
  {
    id: 'r-v1',
    chapter: 'rules',
    title: 'Wariant 1 — godziny uśrednione',
    icon: Percent,
    route: '/',
    body: RVariant1,
  },
  {
    id: 'r-absence',
    chapter: 'rules',
    title: 'Nieobecność, zastępstwa, indywidualne',
    icon: Wrench,
    route: '/',
    body: RAbsence,
  },
  {
    id: 'r-class5',
    chapter: 'rules',
    title: 'Klasy 5 i zajęcia zawodowe',
    icon: Layers,
    route: '/',
    body: RClass5,
  },
  {
    id: 'r-v2',
    chapter: 'rules',
    title: 'Wariant 2 — według realnych przydziałów',
    icon: ListChecks,
    route: '/',
    body: RVariant2,
  },
  {
    id: 'r-absence2',
    chapter: 'rules',
    title: 'Nieobecności, wycieczki, egzaminy',
    icon: CalendarPlus,
    route: '/',
    body: RAbsence2,
  },
  {
    id: 'r-compare',
    chapter: 'rules',
    title: 'Który wariant wybrać?',
    icon: Scale,
    route: '/',
    body: RCompare,
  },
  {
    id: 'r-deadline',
    chapter: 'rules',
    title: 'Co teraz zrobić?',
    icon: PartyPopper,
    route: '/',
    body: RDeadline,
  },
];

export const TOUR_STEPS: TourStep[] = [...UI_STEPS, ...RULES_STEPS];

export function stepsFor(chapter: 'all' | 'ui' | 'rules'): TourStep[] {
  return chapter === 'all' ? TOUR_STEPS : TOUR_STEPS.filter((s) => s.chapter === chapter);
}

export const CHAPTER_LABEL = {
  all: 'Cały samouczek',
  ui: 'Interfejs',
  rules: 'Rozliczanie nadgodzin',
} as const;
