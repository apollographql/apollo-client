import { test as base, expect } from "@playwright/test";
import { version } from "@apollo/client";
import { readFile, writeFile } from "node:fs/promises";

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
    let contents = await readFile("../api.har", "utf-8");
    contents = contents.replace("__VERSION__", version);
    await writeFile("../api.har", contents, "utf-8");

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
