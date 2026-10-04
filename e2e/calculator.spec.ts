import { expect, test } from './fixtures';
import { openStep, setWeekly, watchErrors } from './helpers';

test.describe('teacher calculator', () => {
  test("works without an account and follows the director's formula", async ({ page }) => {
    const problems = watchErrors(page);
    await openStep(page, 'dane');
    await expect(page.getByRole('heading', { name: /Kalkulator nadgodzin/ })).toBeVisible();
    await page.getByLabel('Imię i nazwisko').fill('Zażółć Gęślą');

    await openStep(page, 'przydzial');
    await setWeekly(page, /Klasy 1.2 — suma/, 10);
    await setWeekly(page, /Klasy 3.4 — suma/, 10);
    await setWeekly(page, /Klasy 5 — suma/, 5);

    // 10×1 + 10×0,9 + 5×0,8 = 23 weighted hours → 5 h/week → 20,80 → 21 h/month → 210 h/year
    await expect(page.getByText('23', { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId('overtime-total')).toHaveText('210');
    expect(problems).toEqual([]);
  });

  test('typing and removing hours is acknowledged with +/- bubbles', async ({ page }) => {
    await openStep(page, 'przydzial');
    await setWeekly(page, /Klasy 1.2 — suma/, 15);
    await expect(page.getByText('+3').first()).toBeVisible();
    const monday = page.getByLabel('Klasy 1–2, Pn');
    await monday.fill('0');
    await monday.blur();
    await expect(page.getByText('−3').first()).toBeVisible();
  });

  test('part-time contract changes the result immediately', async ({ page }) => {
    await openStep(page, 'przydzial');
    await setWeekly(page, /Klasy 1.2 — suma/, 10);
    await expect(page.getByTestId('overtime-total')).toHaveText('0'); // 10 h < 18 h pensum
    await openStep(page, 'dane');
    await page.getByRole('radio', { name: '1/2' }).click(); // 9 h
    await expect(page.getByTestId('overtime-total')).toHaveText('40'); // (10 − 9) × 4,16 → 4 h × 10 months
  });

  test('keeps the data after a reload (localStorage)', async ({ page }) => {
    await openStep(page, 'dane');
    await page.getByLabel('Imię i nazwisko').fill('Jan Testowy');
    await page.reload();
    await expect(page.getByLabel('Imię i nazwisko')).toHaveValue('Jan Testowy');
  });

  test('weekly table shows the real calendar and accepts "3+1"', async ({ page }) => {
    await openStep(page, 'przydzial');
    await setWeekly(page, /Klasy 1.2 — suma/, 20);
    await page.getByRole('radio', { name: 'Wariant 2' }).click();
    await openStep(page, 'tabela');

    await expect(page.getByLabel(/14\.10 — Dzień Edukacji Narodowej/)).toBeVisible();
    await expect(page.getByLabel(/11\.11 — Narodowe Święto Niepodległości/)).toBeVisible();
    await expect(page.getByLabel(/01\.02 — Ferie zimowe/)).toBeVisible();
    await expect(page.getByLabel(/04\.05, liczba godzin \(dzień egzaminów/)).toBeVisible();

    const cell = page.getByLabel('08.09, liczba godzin');
    await cell.fill('3+1');
    await cell.press('Enter');
    await expect(page.getByLabel('08.09, liczba godzin')).toHaveValue('3+1');
    await page.reload();
    await expect(page.getByLabel('08.09, liczba godzin')).toHaveValue('3+1');
  });

  test('rejects nonsense in a cell', async ({ page }) => {
    await openStep(page, 'tabela');
    const cell = page.getByLabel('08.09, liczba godzin');
    await cell.fill('abc');
    await cell.press('Enter');
    await expect(page.getByText(/Wpisz liczbę godzin/)).toBeVisible();
  });

  test('a trip lowers the overtime and is listed', async ({ page }) => {
    await openStep(page, 'przydzial');
    await setWeekly(page, /Klasy 1.2 — suma/, 15);
    await setWeekly(page, /Klasy 3.4 — suma/, 10);
    // 15 + 10 × 0,9 = 24 → 6 h/week → 24,96 → 25 h/month → 250 h/year
    await expect(page.getByTestId('overtime-total')).toHaveText('250');

    await openStep(page, 'wydarzenia');
    await page.getByLabel('Od', { exact: true }).fill('2026-10-06');
    await page.getByLabel('Do', { exact: true }).fill('2026-10-08');
    await page.getByRole('button', { name: 'Dodaj wydarzenie' }).click();
    await expect(page.getByText('Twoje wydarzenia (1)')).toBeVisible();

    // 3 absent lesson days in October (22 working days): 25 − round(25 ÷ 22 × 3) = 22 → 247 h/year
    await expect(page.getByTestId('overtime-total')).toHaveText('247');
  });

  test('exports PDF, Word and Excel', async ({ page }) => {
    const problems = watchErrors(page);
    await openStep(page, 'dane');
    await page.getByLabel('Imię i nazwisko').fill('Zażółć Gęślą');
    await openStep(page, 'przydzial');
    await setWeekly(page, /Klasy 1.2 — suma/, 25);
    await page.getByRole('radio', { name: 'Wariant 2' }).click();
    await openStep(page, 'wynik');

    const [pdf] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'PDF' }).click(),
    ]);
    expect(pdf.suggestedFilename()).toBe('nadgodziny-zazolc-gesla-2026-2027.pdf');
    const pdfPath = await pdf.path();
    const { readFileSync } = await import('node:fs');
    const pdfBytes = readFileSync(pdfPath);
    expect(pdfBytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdfBytes.length).toBeGreaterThan(20_000);

    const [docx] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Word' }).click(),
    ]);
    expect(docx.suggestedFilename()).toBe('nadgodziny-zazolc-gesla-2026-2027.docx');
    const docxBytes = readFileSync(await docx.path());
    expect(docxBytes.subarray(0, 2).toString()).toBe('PK'); // a .docx is a zip
    expect(docxBytes.length).toBeGreaterThan(5_000);

    const [xlsx] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Excel' }).click(),
    ]);
    expect(xlsx.suggestedFilename()).toBe('nadgodziny-zazolc-gesla-2026-2027.xlsx');
    const xlsxBytes = readFileSync(await xlsx.path());
    expect(xlsxBytes.subarray(0, 2).toString()).toBe('PK'); // an .xlsx is a zip too
    expect(xlsxBytes.length).toBeGreaterThan(5_000);
    expect(problems).toEqual([]);
  });

  test('backup round-trip', async ({ page }) => {
    await openStep(page, 'dane');
    await page.getByLabel('Imię i nazwisko').fill('Kopia Zapasowa');
    await openStep(page, 'wynik');
    const [backup] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Zapisz kopię' }).click(),
    ]);
    const path = await backup.path();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('input[type=file][accept*=json]').setInputFiles(path);
    await expect(page.getByText('Wczytano kopię kalkulatora.')).toBeVisible();
    await openStep(page, 'dane');
    await expect(page.getByLabel('Imię i nazwisko')).toHaveValue('Kopia Zapasowa');
  });
});

test.describe('public pages', () => {
  test('calendar and rules render without errors', async ({ page }) => {
    const problems = watchErrors(page);
    await page.goto('/kalendarz');
    await expect(page.getByRole('heading', { name: /Kalendarz roku szkolnego/ })).toBeVisible();
    await expect(page.getByText('Wrzesień 2026')).toBeVisible();
    await page.goto('/zasady');
    // the director's example: 21,83 → 14
    await expect(page.getByText(/godzin do wypłaty po uwzględnieniu nieobecności/)).toBeVisible();
    await expect(page.locator('.num.text-4xl').first()).toHaveText('14');
    expect(problems).toEqual([]);
  });

  test('unknown routes show a friendly page', async ({ page }) => {
    await page.goto('/nie-ma-takiej-strony');
    await expect(page.getByText('Nie ma takiej strony')).toBeVisible();
  });
});
