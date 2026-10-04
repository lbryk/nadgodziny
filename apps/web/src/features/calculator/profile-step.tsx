import { RotateCcw, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Callout } from '../../components/ui/callout';
import { Card, CardBody, CardHeader } from '../../components/ui/card';
import { Field, Input, NumberField } from '../../components/ui/field';
import { Modal } from '../../components/ui/dialog';
import { Segmented } from '../../components/ui/segmented';
import { Toggle } from '../../components/ui/switch';
import { useCalc } from '../../hooks/calc-context';
import { fmt } from '../../lib/format';
import { usePlanStore } from '../../state/plan-store';
import { toast } from 'sonner';

type EtatPreset = 'full' | '0.75' | '0.5' | '0.25' | 'custom';

function etatPreset(contract: number, full: number): EtatPreset {
  const ratio = contract / full;
  const near = (x: number) => Math.abs(ratio - x) < 0.001;
  if (near(1)) return 'full';
  if (near(0.75)) return '0.75';
  if (near(0.5)) return '0.5';
  if (near(0.25)) return '0.25';
  return 'custom';
}

export function ProfileStep() {
  const { plan, settings } = useCalc();
  const { patch, setPensumFull, setContractHours, reset } = usePlanStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const [customEtat, setCustomEtat] = useState(false);

  const presets = settings.pensumPresets;
  const pensumIsPreset = presets.includes(plan.pensumFull);
  const [customPensum, setCustomPensum] = useState(!pensumIsPreset);
  const detected = etatPreset(plan.contractHours, plan.pensumFull);
  const etat: EtatPreset = customEtat ? 'custom' : detected;
  const percent = Math.round((plan.contractHours / plan.pensumFull) * 100);

  return (
    <div className="space-y-6">
      <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <CardHeader
          icon={<UserRound className="size-5" />}
          title="Dane nauczyciela"
          description="Imię i nazwisko trafi na wydruk. Nie musisz zakładać konta — wszystko zapisuje się w tej przeglądarce."
        />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Field label="Imię i nazwisko" className="sm:col-span-2">
            {(id) => (
              <Input
                id={id}
                value={plan.teacherName}
                onChange={(e) => patch({ teacherName: e.target.value })}
                placeholder="np. Anna Kowalska"
                autoComplete="name"
                maxLength={160}
              />
            )}
          </Field>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[13px] font-medium">Pensum — pełny etat dla Twojego zatrudnienia</span>
            <div className="flex flex-wrap items-center gap-3">
              <Segmented
                aria-label="Pensum"
                value={customPensum ? ('custom' as const) : plan.pensumFull}
                onChange={(v) => {
                  if (v === 'custom') setCustomPensum(true);
                  else {
                    setCustomPensum(false);
                    setPensumFull(v);
                  }
                }}
                options={[
                  ...presets.map((p) => ({ value: p as number | 'custom', label: `${p} godz.` })),
                  { value: 'custom' as const, label: 'Inne' },
                ]}
              />
              {customPensum && (
                <NumberField
                  className="w-32"
                  value={plan.pensumFull}
                  min={1}
                  max={60}
                  step={0.5}
                  suffix="godz."
                  aria-label="Pensum w godzinach"
                  onChange={setPensumFull}
                />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[13px] font-medium">Wymiar zatrudnienia (etat)</span>
            <div className="flex flex-wrap items-center gap-3">
              <Segmented<EtatPreset>
                aria-label="Etat"
                value={etat}
                onChange={(v) => {
                  setCustomEtat(v === 'custom');
                  if (v !== 'custom') setContractHours(Math.round(plan.pensumFull * (v === 'full' ? 1 : Number(v)) * 100) / 100);
                }}
                options={[
                  { value: 'full', label: 'Pełny etat' },
                  { value: '0.75', label: '3/4' },
                  { value: '0.5', label: '1/2' },
                  { value: '0.25', label: '1/4' },
                  { value: 'custom', label: 'Własny' },
                ]}
              />
              {etat === 'custom' && (
                <NumberField
                  className="w-32"
                  value={plan.contractHours}
                  min={0.5}
                  max={plan.pensumFull}
                  step={0.5}
                  suffix="godz."
                  aria-label="Liczba godzin w umowie"
                  onChange={setContractHours}
                />
              )}
              <Badge tone="brand">
                {fmt(plan.contractHours)} godz./tydz. · {percent}% etatu
              </Badge>
            </div>
            <p className="text-xs text-muted">
              Nadgodziny liczą się od tego wymiaru. Zmiana etatu od razu przelicza wszystkie wyniki.
            </p>
          </div>

          <div className="sm:col-span-2">
            <Toggle
              checked={plan.individualInPensum}
              onChange={(individualInPensum) => patch({ individualInPensum })}
              label="Nauczanie indywidualne jest wliczone do mojego wymiaru zatrudnienia"
              description="Dotyczy nauczycieli z niepełnym etatem. Takie godziny trzeba bezwzględnie przepracować — nie są płatne dodatkowo, a nieodbyte odpracowuje się w kolejnym miesiącu."
            />
          </div>

          <Field
            label="Stawka za godzinę ponadwymiarową (opcjonalnie)"
            hint="Tylko do orientacyjnego przeliczenia na złotówki — nie jest nigdzie wysyłana."
          >
            {(id) => (
              <NumberField
                id={id}
                value={plan.hourlyRate ?? 0}
                min={0}
                max={1000}
                step={1}
                suffix="zł"
                placeholder="np. 85"
                onChange={(v) => patch({ hourlyRate: v > 0 ? v : null })}
              />
            )}
          </Field>
        </CardBody>
      </Card>

      <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
        <CardHeader
          title="Który wariant rozliczenia?"
          description="Wariant możesz zmienić w każdej chwili — kalkulator zawsze liczy oba i pokazuje różnicę."
        />
        <CardBody className="grid gap-3 md:grid-cols-2">
          {([
            {
              v: 1 as const,
              title: 'Wariant 1 — uśredniony',
              body: 'Godziny ważone (kl. 1–2 = 1, kl. 3–4 ≈ 0,9, kl. 5 ≈ 0,8) minus pensum, razy 4,16 tygodnia. Taka sama liczba nadgodzin co miesiąc, niezależnie od tego, czy pracujesz więcej, czy mniej.',
            },
            {
              v: 2 as const,
              title: 'Wariant 2 — realny',
              body: 'Wypełniasz tabelę tygodniową z kalendarzem szkoły. Nadgodziny to godziny powyżej uśrednionego pensum, miesiąc po miesiącu, według faktycznego przydziału.',
            },
          ]).map((o) => {
            const active = plan.variant === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => patch({ variant: o.v })}
                aria-pressed={active}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  active ? 'border-brand bg-brand-soft ring-4 ring-brand/10' : 'border-line hover:border-brand/40'
                }`}
              >
                <span className="flex items-center justify-between gap-2 font-semibold">
                  {o.title}
                  {active && <Badge tone="brand">wybrany</Badge>}
                </span>
                <span className="mt-1.5 block text-sm text-muted">{o.body}</span>
              </button>
            );
          })}
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Callout tone="info" className="min-w-64 flex-1">
          Gotowy plik PDF lub DOCX pobierzesz w zakładce „Wynik”. Kopię roboczą (JSON) możesz zapisać i wczytać na innym komputerze.
        </Callout>
        <Button variant="danger" onClick={() => setConfirmReset(true)}>
          <RotateCcw className="size-4" /> Zacznij od nowa
        </Button>
      </div>

      <Modal
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Zacząć od nowa?"
        description="Usuniemy przydział, ręczne zmiany w tabeli i wszystkie wydarzenia z tej przeglądarki."
        footer={
          <>
            <Button onClick={() => setConfirmReset(false)}>Anuluj</Button>
            <Button
              variant="primary"
              onClick={() => {
                reset(settings.defaultPensum);
                setConfirmReset(false);
                setCustomPensum(false);
                setCustomEtat(false);
                toast.success('Kalkulator wyczyszczony.');
              }}
            >
              Tak, wyczyść
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Tej operacji nie można cofnąć. Jeśli chcesz zachować dane, najpierw zapisz kopię w zakładce „Wynik”.</p>
      </Modal>
    </div>
  );
}
