import { expect } from "@playwright/test";
import { test } from "shared/fixture";

test("Basic Test", async ({ withHar }) => {
  await withHar.goto("http://localhost:3000/unpkg-unmangled.html");

  await expect(withHar.getByText("loading")).toBeVisible();
  await expect(withHar.getByText("loading")).not.toBeVisible({
    timeout: 10000,
  });
  await expect(withHar.getByText("Soft Warm Apollo Beanie")).toBeVisible();
});
