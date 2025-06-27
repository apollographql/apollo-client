import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [...configDefaults.include, "**/__tests__/*.test.ts"],
    globals: true,
  },
});
