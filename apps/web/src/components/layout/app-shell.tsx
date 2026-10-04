import { BookOpenText, CalendarDays, Calculator, CloudOff } from 'lucide-react';
import { LayoutGroup, motion } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCalc } from '../../hooks/calc-context';
import { cn } from '../../lib/cn';
import { Badge } from '../ui/badge';
import { LogoMark } from '../ui/logo';
import { TourMenu } from '../../features/tour/tour-menu';
import { ThemeToggle } from './theme-toggle';

const NAV = [
  { to: '/', label: 'Kalkulator', icon: Calculator, end: true },
  { to: '/kalendarz', label: 'Kalendarz', icon: CalendarDays },
  { to: '/zasady', label: 'Zasady', icon: BookOpenText },
] as const;

/**
 * The administrator entry is deliberately not linked anywhere. It opens with Ctrl+Alt+A
 * or by clicking the logo five times in a row.
 */
function useHiddenAdminEntry() {
  const navigate = useNavigate();
  const clicks = useRef<number[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        navigate('/admin');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return () => {
    const now = Date.now();
    clicks.current = [...clicks.current.filter((t) => now - t < 2500), now];
    if (clicks.current.length >= 5) {
      clicks.current = [];
      navigate('/admin');
    }
  };
}

export function AppShell({ children }: { children: ReactNode }) {
  const { settings, configSource } = useCalc();
  const onLogoClick = useHiddenAdminEntry();
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="no-print bg-aurora flex min-h-dvh flex-col">
      <header className="glass sticky top-0 z-40 border-b border-line/70">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={onLogoClick}
            className="flex items-center gap-3 rounded-xl text-left outline-offset-4"
            aria-label="Nadgodziny — strona główna"
            tabIndex={-1}
          >
            <LogoMark className="size-9" />
          </button>
          <NavLink to="/" className="hidden min-w-0 leading-tight sm:block">
            <span className="block text-[15px] font-semibold tracking-tight">Nadgodziny</span>
            <span className="block truncate text-xs text-muted">
              {settings.schoolName} · rok {settings.schoolYearStart}/{settings.schoolYearStart + 1}
            </span>
          </NavLink>

          <LayoutGroup id="main-nav">
            <nav
              className="mx-auto flex items-center gap-1 rounded-2xl bg-surface-2/70 p-1"
              aria-label="Główna nawigacja"
              data-tour="nav"
            >
              {NAV.map(({ to, label, icon: Icon, ...rest }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={'end' in rest}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors sm:px-4',
                      isActive ? 'text-ink' : 'text-muted hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="nav-pill"
                          className="absolute inset-0 rounded-xl bg-surface shadow-sm ring-1 ring-line"
                          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                        />
                      )}
                      <Icon className="relative z-10 size-4" />
                      <span className="relative z-10 hidden sm:inline">{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </LayoutGroup>

          <div className="flex items-center gap-2">
            {configSource !== 'server' && (
              <Badge tone="warn" className="hidden md:inline-flex">
                <CloudOff className="size-3" /> tryb lokalny
              </Badge>
            )}
            <TourMenu />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-line/70 py-6 text-center text-xs text-muted">
        <p>
          Dane wpisane w kalkulatorze zapisują się wyłącznie w tej przeglądarce — nie trzeba
          zakładać konta.
        </p>
      </footer>
    </div>
  );
}
