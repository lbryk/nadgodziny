import { expect, type Page } from '@playwright/test';

export const ADMIN = { user: 'admin', password: 'e2e-admin-password-1' };

/** Collects CSP violations and uncaught errors so every spec can assert on them. */
export function watchErrors(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error' && !text.includes('401')) problems.push(`console: ${text}`);
    if (/content security policy/i.test(text)) problems.push(`csp: ${text}`);
  });
  return problems;
}

export async function openStep(
  page: Page,
  step: 'dane' | 'przydzial' | 'tabela' | 'wydarzenia' | 'wynik',
) {
  await page.goto(step === 'dane' ? '/' : `/?krok=${step}`);
}

/** Types a weekly total into the timetable row (the app spreads it over five days). */
export async function setWeekly(page: Page, row: RegExp, hours: number) {
  const input = page.getByLabel(row);
  await input.fill(String(hours));
  await input.blur();
}

export async function loginAsAdmin(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Login').fill(ADMIN.user);
  await page.getByLabel('Hasło', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Zaloguj' }).click();
  await expect(page.getByRole('heading', { name: 'Panel administratora' })).toBeVisible();
}

/** A calendar-like picture drawn in the page, so the OCR test needs no binary fixture. */
export async function calendarScreenshot(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 260;
    const x = c.getContext('2d')!;
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#111';
    x.font = '28px Arial';
    x.fillText('02.11.2026 - Dzień wolny od zajęć', 20, 50);
    x.fillText('Egzaminy 15.06.2027', 20, 110);
    return c.toDataURL('image/png');
  });
  return Buffer.from(dataUrl.split(',')[1]!, 'base64');
}
