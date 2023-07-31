import { test as base, expect } from "@playwright/test";

export const test = base.extend<{
  withHar: import("@playwright/test").Page;
  blockRequest: import("@playwright/test").Page;
}>({
  page: async ({ page }, use) => {
    page.on("pageerror", (error) => {
      expect(error.stack || error).toBe("no error");
    });
    await use(page);
  },
  withHar: async ({ page }, use) => {
    await page.routeFromHAR("../api.har", {
      url: "**/graphql",
      notFound: "abort",
    });
    await use(page);
  },
  blockRequest: async ({ page }, use) => {
    await page.routeFromHAR("../empty.har", {
      url: "**/graphql",
      notFound: "abort",
    });
    await use(page);
  },
});
