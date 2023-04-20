const defaults = {
  rootDir: "src",
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFiles: ["<rootDir>/config/jest/setup.ts"],
  testEnvironmentOptions: {
    url: "http://localhost",
  },
  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        diagnostics: {
          warnOnly: process.env.TEST_ENV !== 'ci'
        },
      },
    ],
  },
};

const ignoreTSFiles = '.ts$';
const ignoreTSXFiles = '.tsx$';

const tsStandardConfig = {
  ...defaults,
  displayName: 'Core Tests',
  testPathIgnorePatterns: [ignoreTSXFiles],
}

// For both React (Jest) "projects", ignore core tests (.ts files) as they
// do not import React, to avoid running them twice.
const standardReact18Config = {
  ...defaults,
  displayName: "ReactDOM 18",
  testPathIgnorePatterns: [ignoreTSFiles],
};

const standardReact17Config = {
  ...defaults,
  displayName: "ReactDOM 17",
  testPathIgnorePatterns: [ignoreTSFiles],
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
    tsStandardConfig,
    standardReact17Config,
    standardReact18Config,
  ],
};
