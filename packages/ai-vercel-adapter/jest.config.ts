import { join } from "node:path";
import { fileURLToPath } from "node:url";

export default {
  rootDir: "src",
  preset: "ts-jest",
  testEnvironment: fileURLToPath(
    import.meta.resolve("../../config/FixJSDOMEnvironment.js")
  ),
  setupFilesAfterEnv: ["<rootDir>/../config/jest/setup.ts"],
  testEnvironmentOptions: {
    url: "http://localhost",
  },
  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true,
  },
  transform: {
    "\\.tsx?$": [
      "ts-jest",
      {
        isolatedModules: true,
        tsconfig: join(import.meta.dirname, "tsconfig.json"),
      },
    ],
  },
  transformIgnorePatterns: ["/node_modules/(?!(rxjs)/)"],
  prettierPath: null,
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  displayName: "AI Vercel Adapter Tests",
  testPathIgnorePatterns: [".d.ts$"],
};
