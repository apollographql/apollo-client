import type { Config } from "jest";

const config: Config = {
  globals: {
    "globalThis.__DEV__": JSON.stringify(true),
  },
  testEnvironment: "jsdom",
  setupFiles: ["./tests/jest.polyfills.js"],
  setupFilesAfterEnv: ["./tests/setupTests.ts"],
  transform: {
    "\\.(gql|graphql)$": "@graphql-tools/jest-transform",
    ".*": "babel-jest",
  },
  testEnvironmentOptions: {
    customExportConditions: [""],
  },
};

export default config;
