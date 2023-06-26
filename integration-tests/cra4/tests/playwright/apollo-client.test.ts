import { test, expect } from '@playwright/test';

test('Basic Test', async ({ page }) => {
  await page.routeFromHAR('../api.har', {
    url: '**/graphql',
  });
  await page.goto('http://localhost:3000');

  await expect(page.getByText('loading')).toBeVisible();
  await expect(page.getByText('loading')).not.toBeVisible();
  await expect(page.getByText('Soft Warm Apollo Beanie')).toBeVisible();
});
