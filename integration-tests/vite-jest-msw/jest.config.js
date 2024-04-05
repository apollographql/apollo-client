const config = {
  globals: {
    "globalThis.__DEV__": JSON.stringify(true),
  },
  testEnvironment: "jsdom",
  setupFiles: ["./tests/jest.polyfills.js"],
  setupFilesAfterEnv: ["./tests/setupTests.js"],
  transform: {
    "\\.(gql|graphql)$": "@graphql-tools/jest-transform",
    ".*": "babel-jest",
  },
  testEnvironmentOptions: {
    customExportConditions: [""],
  },
};

export default config;
