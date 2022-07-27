const { compilerOptions } = require("../tsconfig.json");

const defaults = {
  rootDir: "src",
  preset: "ts-jest/presets/js-with-ts",
  testEnvironment: "jsdom",
  setupFiles: ["<rootDir>/config/jest/setup.ts"],
  testEnvironmentOptions: {
    url: "http://localhost",
  },
  globals: {
    "ts-jest": {
      diagnostics: true,
      tsconfig: {
        ...compilerOptions,
        allowJs: true,
      },
    },
  },
};

// const tsStandardConfig = {
//   ...defaults,
//   displayName: "ReactDOM 18",
// };

const standardReact17Config = {
  ...defaults,
  displayName: "ReactDOM 17",
  moduleNameMapper: {
    "^react$": "react-17",
    "^react-dom$": "react-dom-17",
    "^react-dom/server$": "react-dom-17/server",
    "^react-dom/test-utils$": "react-dom-17/test-utils",
    "^@testing-library/react$": "@testing-library/react-12",
  },
};

module.exports = {
  projects: [
    // tsStandardConfig,
    standardReact17Config,
  ],
};
