import { expect, test as base } from '@playwright/test';

/**
 * Every spec starts as a returning visitor: the tutorial offers itself on the very first visit
 * and would cover the page. The tour spec imports `test` from '@playwright/test' directly.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem(
          'nadgodziny:tour:v1',
          JSON.stringify({ seen: true, completed: true, lastChapter: 'all', lastIndex: 0 }),
        );
      } catch {
        /* storage blocked */
      }
    });
    await use(page);
  },
});

export { expect };
