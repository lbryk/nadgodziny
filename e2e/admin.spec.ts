import { expect, test } from './fixtures';
import { ADMIN, calendarScreenshot, loginAsAdmin, watchErrors } from './helpers';

test.describe('hidden administrator panel', () => {
  test('is not linked anywhere in the public UI', async ({ page }) => {
    await page.goto('/');
    expect(await page.locator('a[href*="admin"]').count()).toBe(0);
    await expect(page.getByText(/administrator/i)).toHaveCount(0);
  });

  test('opens with Ctrl+Alt+A and rejects a wrong password', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+Alt+a');
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByLabel('Login').fill(ADMIN.user);
    await page.getByLabel('Hasło', { exact: true }).fill('zle-haslo');
    await page.getByRole('button', { name: 'Zaloguj' }).click();
    await expect(page.getByText('Nieprawidłowy login lub hasło.')).toBeVisible();
  });

  test('five quick clicks on the logo open the login', async ({ page }) => {
    await page.goto('/');
    const logo = page.getByRole('button', { name: /strona główna/ });
    for (let i = 0; i < 5; i += 1) await logo.click({ force: true });
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("settings: weights and weeks per month change every teacher's result", async ({
    page,
    browser,
  }) => {
    const problems = watchErrors(page);
    await loginAsAdmin(page);
    const weight = page.getByLabel('Waga (liczba): Klasy 3–4');
    await weight.fill('0,8');
    await weight.blur();
    await page.getByRole('button', { name: 'Zapisz ustawienia' }).click();
    await expect(page.getByText(/Ustawienia zapisane/)).toBeVisible();

    // a visitor without any login sees the new weight on the rules page
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto('/zasady');
    await expect(visitor.getByText('Klasy 3–4').locator('..').getByText('0,8')).toBeVisible();
    await visitor.context().close();

    // restore the factory value for the following tests
    await weight.fill('0,9');
    await weight.blur();
    await page.getByRole('button', { name: 'Zapisz ustawienia' }).click();
    await expect(page.getByText(/Ustawienia zapisane/).first()).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("calendar: add a day from the form and publish it to the teachers' table", async ({
    page,
    browser,
  }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'Kalendarz i dni wolne' }).click();
    await page.getByLabel('Data', { exact: true }).fill('2026-11-02');
    await page.getByLabel('Opis (opcjonalnie)').fill('Dzień po Wszystkich Świętych');
    await page.getByRole('button', { name: 'Dodaj do kalendarza' }).click();
    await expect(page.getByText('Masz niezapisane zmiany w kalendarzu.')).toBeVisible();
    await page.getByRole('button', { name: 'Zapisz kalendarz' }).click();
    await expect(page.getByText(/Kalendarz zapisany/)).toBeVisible();

    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto('/?krok=tabela');
    await expect(visitor.getByLabel(/02\.11 — Dzień po Wszystkich Świętych/)).toBeVisible();
    await visitor.context().close();
  });

  test('calendar: import from an XML file', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'Kalendarz i dni wolne' }).click();
    const xml =
      '<kalendarz><zakres od="2027-06-14" do="2027-06-16" typ="director" nazwa="Dni projektowe"/></kalendarz>';
    await page
      .getByTestId('dropzone-input')
      .setInputFiles({ name: 'dni.xml', mimeType: 'text/xml', buffer: Buffer.from(xml) });
    await expect(page.getByText(/Znaleziono 3 dni/)).toBeVisible();
    await page.getByRole('button', { name: /Dodaj zaznaczone \(3\)/ }).click();
    await expect(page.getByLabel('Opis dnia 15.06.2027')).toHaveValue('Dni projektowe');
  });

  test('calendar: import from a screenshot (OCR runs in the browser)', async ({ page }) => {
    const problems = watchErrors(page);
    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'Kalendarz i dni wolne' }).click();
    await page.getByRole('radio', { name: /Zdjęcie/ }).click();
    await page.getByTestId('dropzone-input').setInputFiles({
      name: 'zrzut.png',
      mimeType: 'image/png',
      buffer: await calendarScreenshot(page),
    });
    await expect(page.getByText(/Znaleziono 2 dni/)).toBeVisible({ timeout: 90_000 });
    await expect(page.getByLabel('Rozpoznany tekst')).toHaveValue(/02\.11\.2026/);
    expect(problems.filter((p) => p.startsWith('csp:'))).toEqual([]);
  });

  test('account: change password and log in again', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'Konto i kopie' }).click();
    await page.getByLabel('Obecne hasło').fill(ADMIN.password);
    await page.getByLabel('Nowe hasło', { exact: true }).fill('another-long-password-2');
    await page.getByLabel('Powtórz nowe hasło').fill('another-long-password-2');
    await page.getByRole('button', { name: 'Zmień hasło' }).click();
    await expect(page.getByText('Hasło zostało zmienione.')).toBeVisible();
    await page.getByRole('button', { name: 'Wyloguj' }).click();
    await expect(page.getByRole('heading', { name: 'Panel administratora' })).toBeVisible();
    await page.getByLabel('Login').fill(ADMIN.user);
    await page.getByLabel('Hasło', { exact: true }).fill('another-long-password-2');
    await page.getByRole('button', { name: 'Zaloguj' }).click();
    await expect(page.getByText('Zalogowano jako')).toBeVisible();
    // put the original password back so the suite stays re-runnable against a reused server
    await page.getByRole('button', { name: 'Konto i kopie' }).click();
    await page.getByLabel('Obecne hasło').fill('another-long-password-2');
    await page.getByLabel('Nowe hasło', { exact: true }).fill(ADMIN.password);
    await page.getByLabel('Powtórz nowe hasło').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Zmień hasło' }).click();
    await expect(page.getByText('Hasło zostało zmienione.').first()).toBeVisible();
  });
});
