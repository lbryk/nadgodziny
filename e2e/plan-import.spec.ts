import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { openStep, watchErrors } from './helpers';

const fixture = (name: string) =>
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);

/** Hours per weekday of the sample plan: Pn 2+2+1, Wt 2+2, Śr 1+2, Cz 3, Pt 2. */
const WEEK = [5, 4, 3, 3, 2];

async function openDialog(page: Page) {
  await openStep(page, 'przydzial');
  await page.getByTestId('plan-import-open').click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function dayTotal(page: Page, day: string) {
  let sum = 0;
  for (const row of ['Klasy 1–2', 'Klasy 3–4', 'Klasy 5', 'Nauczanie indywidualne']) {
    sum += Number((await page.getByLabel(`${row}, ${day}`).inputValue()).replace(',', '.') || 0);
  }
  return sum;
}

test.describe('loading hours from a lesson plan', () => {
  for (const file of ['plan-tydzien.docx', 'plan-tydzien.doc', 'plan-tydzien.pdf']) {
    test(`weekly plan from ${file} is split into weekdays`, async ({ page }) => {
      const problems = watchErrors(page);
      await openDialog(page);
      await page.getByTestId('plan-file').setInputFiles(fixture(file));
      await expect(page.getByTestId('plan-block')).toHaveCount(5, { timeout: 60_000 });
      await page.getByTestId('plan-apply').click();
      await expect(page.getByText(/Zaktualizowano przydział/)).toBeVisible();
      const days = ['Pn', 'Wt', 'Śr', 'Czw', 'Pt'];
      for (const [i, d] of days.entries()) expect(await dayTotal(page, d)).toBe(WEEK[i]);
      expect(problems).toEqual([]);
    });
  }

  test('a photo of ONE day is summed into that weekday', async ({ page }) => {
    await openDialog(page);
    await page.getByTestId('plan-file').setInputFiles(fixture('plan-poniedzialek.png'));
    const block = page.getByTestId('plan-block');
    await expect(block).toHaveCount(1, { timeout: 90_000 });
    await expect(block.getByTestId('plan-lesson')).toHaveCount(5);
    await expect(block.getByTestId('plan-sum')).toContainText('5');
    await expect(block.getByLabel('Dzień tygodnia dla tego zestawu')).toHaveValue('0'); // read from the title
    await page.getByTestId('plan-apply').click();
    expect(await dayTotal(page, 'Pn')).toBe(5);
    expect(await dayTotal(page, 'Wt')).toBe(0);
    await expect(page.getByLabel('Klasy 3–4, Pn')).toHaveValue('2');
    await expect(page.getByLabel('Klasy 5, Pn')).toHaveValue('1');
  });

  test('a weekly grid photo is split into columns by OCR', async ({ page }) => {
    await openDialog(page);
    await page.getByTestId('plan-file').setInputFiles(fixture('plan-tydzien.png'));
    await expect(page.getByTestId('plan-block')).toHaveCount(5, { timeout: 90_000 });
    await page.getByTestId('plan-apply').click();
    for (const [i, d] of ['Pn', 'Wt', 'Śr', 'Czw', 'Pt'].entries())
      expect(await dayTotal(page, d)).toBe(WEEK[i]);
  });

  test('several one-day files are added up and can replace or add', async ({ page }) => {
    await openDialog(page);
    await page.getByTestId('plan-file').setInputFiles(fixture('plan-poniedzialek.docx'));
    await expect(page.getByTestId('plan-block')).toHaveCount(1);
    await page.getByTestId('plan-file').setInputFiles(fixture('plan-wtorek.docx'));
    await expect(page.getByTestId('plan-block')).toHaveCount(2);
    await page.getByTestId('plan-apply').click();
    expect(await dayTotal(page, 'Pn')).toBe(5);
    expect(await dayTotal(page, 'Wt')).toBe(4);

    // the same Monday again with "add" doubles it
    await page.getByTestId('plan-import-open').click();
    await page.getByTestId('plan-file').setInputFiles(fixture('plan-poniedzialek.docx'));
    await expect(page.getByTestId('plan-block')).toHaveCount(1);
    await page.getByRole('radio', { name: 'Dodaj do istniejących' }).click();
    await page.getByTestId('plan-apply').click();
    expect(await dayTotal(page, 'Pn')).toBe(10);
  });

  test('lessons can be corrected before they are saved, and a missing weekday blocks saving', async ({
    page,
  }) => {
    await openDialog(page);
    await page.getByTestId('plan-file').setInputFiles(fixture('plan-poniedzialek.docx'));
    const block = page.getByTestId('plan-block');
    await expect(block.getByTestId('plan-lesson')).toHaveCount(5);
    await block.getByTestId('plan-lesson').first().getByLabel('Usuń lekcję').click();
    await expect(block.getByTestId('plan-lesson')).toHaveCount(4);
    await block.getByLabel('Dzień tygodnia dla tego zestawu').selectOption('');
    await expect(page.getByTestId('plan-apply')).toBeDisabled();
    await block.getByLabel('Dzień tygodnia dla tego zestawu').selectOption('2'); // środa
    await page.getByTestId('plan-apply').click();
    expect(await dayTotal(page, 'Śr')).toBe(4);
  });

  test('pasted text works too', async ({ page }) => {
    await openDialog(page);
    await page.getByText('Albo wklej tekst planu').click();
    await page
      .getByLabel('Tekst planu lekcji')
      .fill(
        'Piątek\n1 07:45-08:30 Matematyka 4TB\n2 08:40-09:25 Matematyka 4TB\n3 09:35-10:20 Informatyka 1TA',
      );
    await page.getByRole('button', { name: 'Rozpoznaj lekcje' }).click();
    await expect(page.getByTestId('plan-block').getByTestId('plan-lesson')).toHaveCount(3);
    await page.getByTestId('plan-apply').click();
    expect(await dayTotal(page, 'Pt')).toBe(3);
  });
});
