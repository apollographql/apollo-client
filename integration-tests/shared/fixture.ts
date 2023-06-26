import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    page.on('pageerror', (error) => {
      expect(error.stack || error).toBe('no error');
    });
    await page.routeFromHAR('../api.har', {
      url: '**/graphql',
    });
    await use(page);
  },
});
