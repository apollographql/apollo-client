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

const react18TestFileIgnoreList = [
  // ignore core tests (.ts files) as they are run separately
  // to avoid running them twice with both react versions
  // since they do not import react
  ignoreTSFiles,
  // failing hoc tests (7)
  'src/react/hoc/__tests__/mutations/queries.test.tsx',
  'src/react/hoc/__tests__/mutations/recycled-queries.test.tsx',
  'src/react/hoc/__tests__/queries/errors.test.tsx',
  'src/react/hoc/__tests__/queries/lifecycle.test.tsx',
  'src/react/hoc/__tests__/queries/loading.test.tsx',
  'src/react/hoc/__tests__/queries/observableQuery.test.tsx',
  'src/react/hoc/__tests__/queries/skip.test.tsx',
  // failing components tests (1)
  'src/react/components/__tests__/client/Query.test.tsx',
];

const tsStandardConfig = {
  ...defaults,
  displayName: 'Core Tests',
  testPathIgnorePatterns: [ignoreTSXFiles],
}

const standardReact18Config = {
  ...defaults,
  displayName: "ReactDOM 18",
  testPathIgnorePatterns: react18TestFileIgnoreList
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
