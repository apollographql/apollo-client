import { expect } from '@playwright/test';
import { test } from 'shared/fixture';

test('Basic Test', async ({ page, withHar }) => {
  await page.goto('http://localhost:3000');

  // sometimes the page just loads too fast, so we cannot check the loading state
  // without being flimsy
  // await expect(page.getByText('loading')).toBeVisible();
  // await expect(page.getByText('loading')).not.toBeVisible();
  await expect(page.getByText('Soft Warm Apollo Beanie')).toBeVisible();
});
