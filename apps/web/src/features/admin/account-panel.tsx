import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_CUSTOM_DAYS,
  DEFAULT_SETTINGS,
  customDaysSchema,
  settingsSchema,
} from '@nadgodziny/core';
import { saveAs } from 'file-saver';
import { Download, FolderUp, KeyRound, RotateCcw } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Callout } from '../../components/ui/callout';
import { Card, CardBody, CardHeader } from '../../components/ui/card';
import { Modal } from '../../components/ui/dialog';
import { Field, Input } from '../../components/ui/field';
import { useConfig, CONFIG_KEY, cacheConfig } from '../../hooks/use-config';
import { api, type PublicConfig } from '../../lib/api';

const passwordSchema = z
  .object({
    current: z.string().min(1, 'Podaj obecne hasło.'),
    next: z.string().min(10, 'Nowe hasło musi mieć co najmniej 10 znaków.'),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ['confirm'], message: 'Hasła nie są takie same.' })
  .refine((v) => v.next !== v.current, {
    path: ['next'],
    message: 'Nowe hasło musi być inne niż obecne.',
  });

export function AccountPanel() {
  const { config } = useConfig();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });

  const onPassword = handleSubmit(async ({ current, next }) => {
    try {
      await api.changePassword(current, next);
      toast.success('Hasło zostało zmienione.');
      reset();
    } catch (e) {
      setError('current', { message: (e as Error).message });
    }
  });

  const applyConfig = (cfg: PublicConfig) => {
    queryClient.setQueryData(CONFIG_KEY, cfg);
    cacheConfig(cfg);
  };

  const restore = useMutation({
    mutationFn: api.restore,
    onSuccess: (cfg) => {
      applyConfig(cfg);
      toast.success('Przywrócono konfigurację.');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <CardHeader
          icon={<KeyRound className="size-5" />}
          title="Zmiana hasła"
          description="Minimum 10 znaków. Hasło jest przechowywane wyłącznie w postaci skrótu (scrypt)."
        />
        <CardBody>
          <form onSubmit={onPassword} className="space-y-4" noValidate>
            <Field label="Obecne hasło" error={errors.current?.message}>
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="current-password"
                  {...register('current')}
                />
              )}
            </Field>
            <Field label="Nowe hasło" error={errors.next?.message}>
              {(id) => (
                <Input id={id} type="password" autoComplete="new-password" {...register('next')} />
              )}
            </Field>
            <Field label="Powtórz nowe hasło" error={errors.confirm?.message}>
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  {...register('confirm')}
                />
              )}
            </Field>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              Zmień hasło
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <CardHeader
          title="Kopia zapasowa konfiguracji"
          description="Ustawienia, wagi i kalendarz (dni wolne, egzaminy) w jednym pliku JSON."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                const blob = new Blob(
                  [
                    JSON.stringify(
                      { settings: config.settings, customDays: config.customDays },
                      null,
                      2,
                    ),
                  ],
                  { type: 'application/json' },
                );
                saveAs(blob, 'nadgodziny-konfiguracja.json');
              }}
            >
              <Download className="size-4" /> Pobierz kopię
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <FolderUp className="size-4" /> Przywróć z pliku
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  const json = JSON.parse(await file.text()) as {
                    settings?: unknown;
                    customDays?: unknown;
                  };
                  const settings = settingsSchema.parse(json.settings);
                  const customDays = customDaysSchema.parse(json.customDays);
                  restore.mutate({ settings, customDays });
                } catch {
                  toast.error('Plik nie jest poprawną kopią konfiguracji.');
                }
              }}
            />
          </div>
          <Callout tone="warn" title="Przywracanie domyślnych">
            Wraca fabryczna konfiguracja (wagi 1 / 0,9 / 0,8, 4,16 tygodnia) i dni z tabeli szkoły
            2026/2027.
          </Callout>
          <Button variant="danger" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="size-4" /> Przywróć ustawienia domyślne
          </Button>
        </CardBody>
      </Card>

      <Modal
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Przywrócić ustawienia domyślne?"
        description="Zmiany wprowadzone w ustawieniach i kalendarzu zostaną zastąpione wartościami fabrycznymi."
        footer={
          <>
            <Button onClick={() => setConfirmReset(false)}>Anuluj</Button>
            <Button
              variant="primary"
              onClick={() => {
                restore.mutate({ settings: DEFAULT_SETTINGS, customDays: DEFAULT_CUSTOM_DAYS });
                setConfirmReset(false);
              }}
            >
              Tak, przywróć
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Najpierw pobierz kopię, jeśli chcesz móc wrócić do obecnej konfiguracji.
        </p>
      </Modal>
    </div>
  );
}
