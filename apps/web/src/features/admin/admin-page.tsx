import { useQueryClient } from '@tanstack/react-query';
import { CalendarCog, LogOut, Settings2, ShieldCheck, UserCog } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { lazy, Suspense, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { useConfig } from '../../hooks/use-config';
import { SESSION_KEY, useSession } from '../../hooks/use-session';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { AccountPanel } from './account-panel';
import { LoginForm } from './login-form';

const SettingsPanel = lazy(() => import('./settings-panel'));
const CalendarPanel = lazy(() => import('./calendar-panel'));

const TABS = [
  { id: 'ustawienia', label: 'Ustawienia i wagi', icon: Settings2 },
  { id: 'kalendarz', label: 'Kalendarz i dni wolne', icon: CalendarCog },
  { id: 'konto', label: 'Konto i kopie', icon: UserCog },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function AdminPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const { config } = useConfig();
  const [tab, setTab] = useState<TabId>('ustawienia');

  if (session.isLoading) {
    return (
      <div className="grid h-64 place-items-center">
        <Spinner className="size-6" />
      </div>
    );
  }
  if (!session.data) return <LoginForm />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <ShieldCheck className="size-8 text-brand" /> Panel administratora
          </h1>
          <p className="text-muted">
            Zalogowano jako <b className="text-ink">{session.data.user}</b> · rewizja konfiguracji{' '}
            <Badge>{config.revision}</Badge>
          </p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            await api.logout();
            await queryClient.resetQueries({ queryKey: SESSION_KEY });
            toast('Wylogowano.');
          }}
        >
          <LogOut className="size-4" /> Wyloguj
        </Button>
      </div>

      <LayoutGroup id="admin-tabs">
        <nav className="scroll-thin flex gap-1 overflow-x-auto" aria-label="Sekcje panelu">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={cn(
                'relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                tab === id ? 'text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {tab === id && (
                <motion.span
                  layoutId="admin-pill"
                  className="absolute inset-0 rounded-xl bg-surface shadow-card ring-1 ring-line"
                  transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                />
              )}
              <Icon className="relative z-10 size-4" />
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </nav>
      </LayoutGroup>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <Suspense fallback={<Spinner className="mx-auto my-16 size-6" />}>
            {tab === 'ustawienia' && <SettingsPanel key={config.revision} />}
            {tab === 'kalendarz' && <CalendarPanel key={config.revision} />}
            {tab === 'konto' && <AccountPanel />}
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
