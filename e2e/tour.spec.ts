import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

const STEPS_ALL = 22;

test.describe('tutorial (samouczek)', () => {
  test('offers itself on the first visit and walks through the interface and the settlement rules', async ({
    page,
  }) => {
    const problems = watchErrors(page);
    await page.goto('/');
    const tour = page.getByTestId('tour');
    await expect(tour).toBeVisible();
    await expect(page.locator('#tour-title')).toHaveText('Witaj w kalkulatorze nadgodzin');
    await expect(tour).toContainText(`Krok 1 z ${STEPS_ALL}`);

    await page.getByTestId('tour-next').click();
    await expect(page.locator('#tour-title')).toHaveText('Menu główne');

    for (let i = 3; i <= STEPS_ALL; i += 1) {
      await page.getByTestId('tour-next').click();
      await expect(tour).toContainText(`Krok ${i} z ${STEPS_ALL}`);
      // the page behind follows the step (the highlighted part of the calculator)
      if (i === 6) await expect(page).toHaveURL(/krok=przydzial/);
      if (i === 9) await expect(page).toHaveURL(/krok=tabela/);
    }

    await expect(page.locator('#tour-title')).toHaveText('Co teraz zrobić?');
    await page.getByTestId('tour-finish').click();
    await expect(tour).toBeHidden();

    // the rules part states the director's worked example
    await page.getByTestId('tour-menu').click();
    await page.getByTestId('tour-rules').click();
    await expect(page.locator('#tour-title')).toHaveText('Podstawy rozliczania');
    await page.getByTestId('tour-next').click();
    await expect(page.getByTestId('tour')).toContainText('21,83');
    await expect(page.getByTestId('tour')).toContainText('15,93');
    await page.getByTestId('tour-next').click();
    await expect(page.getByTestId('tour')).toContainText('14 godz. do wypłaty');

    await page.keyboard.press('Escape');
    await expect(tour).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('can be closed at any step, does not come back by itself and can be resumed', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('tour')).toBeVisible();
    for (let i = 0; i < 4; i += 1) await page.getByTestId('tour-next').click();
    await expect(page.getByTestId('tour')).toContainText(`Krok 5 z ${STEPS_ALL}`);

    await page.getByTestId('tour-close').click();
    await expect(page.getByTestId('tour')).toBeHidden();
    await expect(page.getByText('Samouczek zamknięty')).toBeVisible();

    // a reload is not a reason to nag again
    await page.reload();
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('tour')).toBeHidden();

    // …but the "?" button offers to continue exactly where we stopped
    await page.getByTestId('tour-menu').click();
    await expect(page.getByTestId('tour-resume')).toContainText(`krok 5 z ${STEPS_ALL}`);
    await page.getByTestId('tour-resume').click();
    await expect(page.getByTestId('tour')).toContainText(`Krok 5 z ${STEPS_ALL}`);
  });

  test('"Pomiń samouczek" and the finish button both end it, and it can start over', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('tour-skip').click();
    await expect(page.getByTestId('tour')).toBeHidden();

    await page.getByTestId('tour-menu').click();
    await page.getByTestId('tour-start').click();
    await expect(page.locator('#tour-title')).toHaveText('Witaj w kalkulatorze nadgodzin');

    // jump to the last step with the progress bar and finish
    await page.getByTestId('tour').getByTitle('Co teraz zrobić?').click({ force: true });
    await expect(page.locator('#tour-title')).toHaveText('Co teraz zrobić?');
    await page.getByTestId('tour-finish').click();
    await expect(page.getByTestId('tour')).toBeHidden();

    await page.getByTestId('tour-menu').click();
    await expect(page.getByTestId('tour-resume')).toHaveCount(0); // completed → nothing to resume
  });

  test('highlights real elements of the page', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('tour-next').click(); // → "Menu główne"
    const hole = page.locator('[data-testid=tour] mask rect[rx]');
    await expect(hole).toHaveCount(1);
    const nav = (await page.locator('[data-tour="nav"]').boundingBox())!;
    // the cut-out is the nav bar plus a few pixels of padding on every side
    await expect
      .poll(async () => {
        const box = await hole.boundingBox();
        return box ? Math.abs(box.x + box.width / 2 - (nav.x + nav.width / 2)) : 999;
      })
      .toBeLessThan(3);
    expect((await hole.boundingBox())!.width).toBeGreaterThan(nav.width);
  });

  test('works with the keyboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('tour')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#tour-title')).toHaveText('Menu główne');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#tour-title')).toHaveText('Witaj w kalkulatorze nadgodzin');
  });
});
