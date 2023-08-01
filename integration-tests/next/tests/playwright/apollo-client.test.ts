import { expect } from "@playwright/test";
import { test } from "shared/fixture";

test("RSC", async ({ page, blockRequest }) => {
  await page.goto("http://localhost:3000");

  await expect(page.getByText("Soft Warm Apollo Beanie")).toBeVisible();
});

test("CC", async ({ page, blockRequest }) => {
  await page.goto("http://localhost:3000/cc");

  await expect(page.getByText("Soft Warm Apollo Beanie")).toBeVisible();
});

test("Pages", async ({ page, blockRequest }) => {
  await page.goto("http://localhost:3000/pages");

  await expect(page.getByText("Soft Warm Apollo Beanie")).toBeVisible();
});

test("Pages without SSR", async ({ page, withHar }) => {
  await page.goto("http://localhost:3000/pages-no-ssr");

  await expect(page.getByText("loading")).toBeVisible();
  await expect(page.getByText("loading")).not.toBeVisible();
  await expect(page.getByText("Soft Warm Apollo Beanie")).toBeVisible();
});
