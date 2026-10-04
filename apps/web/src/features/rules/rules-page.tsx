import { variant1Core, variant1Deduction, roundHours } from '@nadgodziny/core';
import { ChevronDown, FlaskConical, ListChecks, Sigma } from 'lucide-react';
import { motion } from 'motion/react';
import { Accordion } from 'radix-ui';
import { useState } from 'react';
import { Callout } from '../../components/ui/callout';
import { Card, CardBody, CardHeader } from '../../components/ui/card';
import { CountUp } from '../../components/ui/count-up';
import { Field, NumberField } from '../../components/ui/field';
import { useCalc } from '../../hooks/calc-context';
import { fmt, fmt2 } from '../../lib/format';

const FAQ = [
  {
    q: 'Dlaczego w wariancie 2 pensum uśrednione bywa wyższe niż 18?',
    a: 'Pensum trzeba wypracować średnio w całym roku. Gdy w pewnych miesiącach godzin ubywa (praktyki uczniowskie, klasy 5 po 30 kwietnia), brakujące godziny trzeba „odpracować wcześniej”. Dlatego w tygodniach z pełnym przydziałem próg nadgodzin wynosi np. 21 godzin, a nie 18. Kalkulator wylicza ten próg dokładnie tak, aby suma nadgodzin w roku równała się rzeczywistej nadwyżce ponad pensum.',
  },
  {
    q: 'Jak liczone są dni egzaminów?',
    a: 'W dni przeznaczone na egzaminy nadgodziny nie są płacone — udział w egzaminach to obowiązek dodatkowy w ramach podstawowego wynagrodzenia. Takie dni (żółte w tabeli) są neutralne: nie wchodzą ani do godzin, ani do obowiązku pensum. Wyjątek: egzaminy ustne oraz funkcja asystenta/operatora — rozliczane odrębnie (dodaj je jako wydarzenie).',
  },
  {
    q: 'Co z wycieczkami i szkoleniami?',
    a: 'Każda nieobecność na zajęciach, także z powodu wycieczki lub szkolenia, jest traktowana jako niezrealizowanie tych zajęć — godziny się odlicza. Rozliczenie samej wycieczki jest odrębnym tematem. Dyrektor nie może płacić podwójnie za tę samą godzinę: jeśli zastępujący nauczyciel ma w tym czasie okienko, jego zastępstwo odbywa się w ramach 40-godzinnego tygodnia pracy i nie jest dodatkowo płatne.',
  },
  {
    q: 'Co z zajęciami w klasach 5?',
    a: 'Trwają do 30 kwietnia 2027 r. włącznie — w maju i czerwcu należy je odjąć. Zajęcia zawodowe w klasach 5 są realizowane do Bożego Narodzenia w podwojonej liczbie, ale płacone w „pojedynczej”, bo wynagrodzenie jest wypłacane przez kolejne miesiące i nie ustaje 1.01.2027. Przy językach i matematyce jest podobnie, tylko mniej godzin przypada przed świętami, a po 1 stycznia więcej.',
  },
  {
    q: 'Zastępstwa i nauczanie indywidualne?',
    a: 'Zastępstwa są dodawane oddzielnie. Nauczanie indywidualne też jest rozliczane oddzielnie — płatne tylko za godziny faktycznie przepracowane, z tematem i frekwencją w dzienniku ucznia. Nauczyciele z niepełnym wymiarem, którym wliczono „indywidualne” do wymiaru zatrudnienia, muszą wypracować tyle godzin, ile otrzymali z góry; nieodbyte odpracowują w kolejnym miesiącu.',
  },
  {
    q: 'Dlaczego księgowość „rozlicza pełne miesiące”?',
    a: 'Wynagrodzenie jest naliczane za cały miesiąc kalendarzowy, dlatego tygodnie przecinające granicę miesiąca są w tabeli podzielone (np. 28.09–30.09 i 01.10–02.10), a nadgodziny sumuje się i zaokrągla do pełnych godzin osobno dla każdego miesiąca.',
  },
];

export default function RulesPage() {
  const { settings } = useCalc();
  const [weighted, setWeighted] = useState(21.83);
  const [pensum, setPensum] = useState(18);
  const [workdays, setWorkdays] = useState(22);
  const [absent, setAbsent] = useState(3);

  const core = variant1Core(weighted, pensum, settings.weeksPerMonth);
  const monthly = roundHours(core.monthlyRaw, settings.rounding);
  const ded = variant1Deduction(monthly, workdays, absent, settings.rounding);
  const payout = Math.max(0, monthly - ded.deduction);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Zasady <span className="text-brand">rozliczania</span> nadgodzin
        </h1>
        <p className="max-w-3xl text-muted">
          Tak liczy kalkulator — to zasady dyrektora, zapisane krok po kroku. Wagi i parametry może zmieniać
          administrator, dlatego tutaj zawsze widać aktualne wartości.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <CardHeader icon={<Sigma className="size-5" />} title="Wariant 1 — godziny uśrednione" description="Od lat stosowany system: nauczyciel dostaje te same nadgodziny co miesiąc." />
          <CardBody className="space-y-3 text-sm leading-relaxed">
            <p>
              Pełną wagę „1” mają tylko godziny w klasach 1 i 2. Godzina w klasach 3 i 4 „waży” ok.{' '}
              <b>{fmt(settings.weights.k34)}</b>, a w klasach 5 ok. <b>{fmt(settings.weights.k5)}</b>. Do liczenia
              nadgodzin stosuje się wymiar nauczycielski, nie uczniowski.
            </p>
            <ol className="space-y-1.5 rounded-xl bg-surface-2/60 p-4 font-mono text-[13px]">
              <li>1. godziny ważone = Σ godziny × waga</li>
              <li>2. nadgodziny / tydzień = ważone − pensum</li>
              <li>3. nadgodziny / miesiąc = tygodniowe × {fmt2(settings.weeksPerMonth)}, w zaokrągleniu</li>
              <li>4. nieobecność: miesięczne ÷ dni robocze × dni nieobecności</li>
            </ol>
            <p className="text-muted">Zastępstwa i nauczanie indywidualne rozliczane są oddzielnie.</p>
          </CardBody>
        </Card>

        <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <CardHeader icon={<ListChecks className="size-5" />} title="Wariant 2 — według realnego przydziału" description="Dla tych, którzy chcą mieć płacone godziny faktycznie wynikające z danego miesiąca." />
          <CardBody className="space-y-3 text-sm leading-relaxed">
            <p>
              Nauczyciel wypełnia tabelę z rozpisaniem na poszczególne tygodnie — od 1.09.2026 do 25.06.2027. Zlicza
              wszystkie realne godziny i odnosi je do pensum (18, 20, 22 lub 30, zależnie od zatrudnienia).
            </p>
            <ul className="list-disc space-y-1.5 pl-5 marker:text-brand">
              <li>Godziny powyżej <b>pensum uśrednionego</b> (np. 21 zamiast 18) są ponadwymiarowe.</li>
              <li>Praktyki i klasy 5 po 30 kwietnia — godziny się odejmuje.</li>
              <li>Nieobecność (wycieczka, szkolenie) to niezrealizowane zajęcia — odliczamy.</li>
              <li>Dni egzaminów — nadgodziny niepłatne.</li>
              <li>Księgowość rozlicza pełne miesiące.</li>
            </ul>
            <p className="text-muted">Każdy musi uśrednić pensum — także nauczyciele z niepełnym wymiarem.</p>
          </CardBody>
        </Card>
      </div>

      <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="overflow-hidden">
        <CardHeader
          icon={<FlaskConical className="size-5" />}
          title="Przykład dyrektora — przelicz na żywo"
          description="Domyślne wartości odtwarzają przykład: przydział 25 godzin uczniowskich ma wagę 21,83, a przy 3 dniach nieobecności we wrześniu wychodzi 14 godzin."
        />
        <CardBody className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Godziny ważone">{(id) => <NumberField id={id} value={weighted} onChange={setWeighted} min={0} max={60} step={0.01} />}</Field>
            <Field label="Pensum">{(id) => <NumberField id={id} value={pensum} onChange={setPensum} min={1} max={60} step={0.5} />}</Field>
            <Field label="Dni robocze w miesiącu" hint="np. wrzesień 2026 = 22">{(id) => <NumberField id={id} value={workdays} onChange={setWorkdays} min={1} max={23} />}</Field>
            <Field label="Dni nieobecności">{(id) => <NumberField id={id} value={absent} onChange={setAbsent} min={0} max={23} step={0.5} />}</Field>
          </div>
          <div className="space-y-2 rounded-2xl bg-surface-2/60 p-4 font-mono text-[13px]">
            <Line>{fmt2(weighted)} − {fmt(pensum)} = <b>{fmt2(core.weeklyOvertime)}</b> godz. nadgodzin / tydzień</Line>
            <Line>
              {fmt2(core.weeklyOvertime)} × {fmt2(settings.weeksPerMonth)} = {fmt2(core.monthlyRaw)} → <b>{monthly}</b> godz. / miesiąc
            </Line>
            <Line>
              {monthly} : {workdays} = {fmt2(ded.perDay)}
            </Line>
            <Line>
              {fmt2(ded.perDay)} × {fmt(absent)} = {fmt2(ded.deductionRaw)} → odejmujemy <b>{ded.deduction}</b>
            </Line>
            <motion.div layout className="mt-3 flex items-baseline justify-between rounded-xl bg-brand-soft px-4 py-3 font-sans">
              <span className="text-sm text-muted">
                {monthly} − {ded.deduction} = godzin do wypłaty po uwzględnieniu nieobecności
              </span>
              <CountUp value={payout} className="num text-4xl font-semibold tracking-tight text-brand" />
            </motion.div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader title="Aktualne wagi i parametry" description="Ustawiane przez administratora." />
          <CardBody>
            <dl className="divide-y divide-line text-sm">
              {[
                ['Klasy 1–2', fmt(settings.weights.k12)],
                ['Klasy 3–4', fmt(settings.weights.k34)],
                ['Klasy 5', fmt(settings.weights.k5)],
                ['Tygodni w miesiącu', fmt2(settings.weeksPerMonth)],
                ['Zaokrąglanie', settings.rounding === 'nearest' ? 'do najbliższej godziny' : settings.rounding === 'up' ? 'w górę' : 'w dół'],
                ['Dni robocze w odliczeniu', settings.workdaysBasis === 'working-days' ? 'pn–pt bez świąt' : 'dni zajęć w szkole'],
                ['Zajęcia kl. 5 do', settings.class5EndDate.split('-').reverse().join('.')],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="num font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Najczęstsze pytania" />
          <CardBody>
            <Accordion.Root type="single" collapsible className="divide-y divide-line">
              {FAQ.map((item) => (
                <Accordion.Item key={item.q} value={item.q}>
                  <Accordion.Header>
                    <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-3.5 text-left text-sm font-medium">
                      {item.q}
                      <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-data-[state=open]:rotate-180" />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="overflow-hidden text-sm leading-relaxed text-muted data-[state=closed]:animate-[acc-up_.2s_ease-out] data-[state=open]:animate-[acc-down_.25s_ease-out]">
                    <p className="pb-4">{item.a}</p>
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </CardBody>
        </Card>
      </div>

      <Callout tone="warn" title="Kalkulator pomaga policzyć, ale nie zastępuje decyzji dyrektora">
        Ostateczne rozliczenie zatwierdza dyrektor i księgowość. Jeżeli zasady się zmienią, administrator zaktualizuje
        wagi i parametry — wyniki przeliczą się automatycznie.
      </Callout>
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return <p className="num leading-relaxed">{children}</p>;
}
