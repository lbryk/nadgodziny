import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
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

/**
 * Page transitions. The location is passed to <Routes> explicitly: AnimatePresence keeps the old
 * element alive while it fades out, and without a frozen location the *exiting* page would re-render
 * with the new route (mounting the next page twice and wiping any form state in it).
 */
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <Suspense fallback={<Loading />}>
          <Routes location={location}>
            <Route path="/" element={<CalculatorPage />} />
            <Route path="/kalendarz" element={<CalendarPage />} />
            <Route path="/zasady" element={<RulesPage />} />
            <Route path="/admin/*" element={<AdminPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
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
                <AnimatedRoutes />
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
