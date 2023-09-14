import { expect } from "@playwright/test";
import { test } from "shared/fixture";

test("Basic Test", async ({ page, withHar }) => {
  await page.goto("http://localhost:3000/jspm-prepared.html");

  await expect(page.getByText("loading")).toBeVisible();
  await expect(page.getByText("loading")).not.toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Soft Warm Apollo Beanie")).toBeVisible();
});
