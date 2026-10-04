import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { motion, useAnimationControls } from 'motion/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Field, Input } from '../../components/ui/field';
import { Spinner } from '../../components/ui/spinner';
import { SESSION_KEY } from '../../hooks/use-session';
import { api } from '../../lib/api';

const schema = z.object({
  username: z.string().trim().min(1, 'Podaj login.'),
  password: z.string().min(1, 'Podaj hasło.'),
});

export function LoginForm() {
  const queryClient = useQueryClient();
  const shake = useAnimationControls();
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ username, password }) => {
    setError(null);
    try {
      const session = await api.login(username, password);
      queryClient.setQueryData(SESSION_KEY, session);
      toast.success('Zalogowano do panelu administratora.');
    } catch (e) {
      setError((e as Error).message);
      void shake.start({ x: [0, -10, 10, -8, 8, -4, 0], transition: { duration: 0.45 } });
    }
  });

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <motion.div animate={shake} className="w-full max-w-sm">
        <Card initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="p-7">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <motion.div
              initial={{ rotate: -12, scale: 0.7 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 14 }}
              className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand"
            >
              <ShieldCheck className="size-7" />
            </motion.div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Panel administratora</h1>
              <p className="mt-1 text-sm text-muted">Dostęp tylko dla osób zarządzających kalendarzem i ustawieniami.</p>
            </div>
          </div>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Login" error={errors.username?.message}>
              {(id) => <Input id={id} autoComplete="username" autoFocus {...register('username')} />}
            </Field>
            <Field label="Hasło" error={errors.password?.message}>
              {(id) => (
                <div className="relative">
                  <Input id={id} type={show ? 'text' : 'password'} autoComplete="current-password" className="pr-10" {...register('password')} />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? 'Ukryj hasło' : 'Pokaż hasło'}
                    className="absolute inset-y-0 right-2 grid w-8 place-items-center text-muted hover:text-ink"
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              )}
            </Field>
            {error && (
              <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Spinner className="text-current" /> : <Lock className="size-4" />} Zaloguj
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
