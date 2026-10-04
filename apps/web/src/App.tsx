import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppShell } from './components/layout/app-shell';
import { TooltipProvider } from './components/ui/tooltip';
import { Spinner } from './components/ui/spinner';
import { CalcProvider } from './hooks/calc-context';
import { PrintHost } from './export/print-host';
import { useThemeStore } from './state/theme-store';

const CalculatorPage = lazy(() => import('./features/calculator/calculator-page'));
const CalendarPage = lazy(() => import('./features/calendar/calendar-page'));
const RulesPage = lazy(() => import('./features/rules/rules-page'));
const AdminPage = lazy(() => import('./features/admin/admin-page'));
const NotFound = lazy(() => import('./features/not-found'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

function Loading() {
  return (
    <div className="grid h-64 place-items-center">
      <Spinner className="size-6" />
    </div>
  );
}

export default function App() {
  const theme = useThemeStore((s) => s.preference);
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <BrowserRouter>
            <CalcProvider>
              <AppShell>
                <Suspense fallback={<Loading />}>
                  <Routes>
                    <Route path="/" element={<CalculatorPage />} />
                    <Route path="/kalendarz" element={<CalendarPage />} />
                    <Route path="/zasady" element={<RulesPage />} />
                    <Route path="/admin/*" element={<AdminPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </AppShell>
              <PrintHost />
            </CalcProvider>
          </BrowserRouter>
          <Toaster
            position="bottom-right"
            theme={theme === 'system' ? 'system' : theme}
            richColors
            closeButton
            toastOptions={{ className: 'font-sans' }}
          />
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
