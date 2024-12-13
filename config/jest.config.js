const defaults = {
  rootDir: "src",
  preset: "ts-jest",
  testEnvironment: require.resolve("./FixJSDOMEnvironment.js"),
  setupFilesAfterEnv: ["<rootDir>/config/jest/setup.ts"],
  globals: {
    __DEV__: true,
  },
  testEnvironmentOptions: {
    url: "http://localhost",
  },
  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true,
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        diagnostics: {
          warnOnly: process.env.TEST_ENV !== "ci",
        },
      },
    ],
  },
  resolver: "ts-jest-resolver",
};

const ignoreTSFiles = ".ts$";
const ignoreTSXFiles = ".tsx$";

const react19TestFileIgnoreList = [ignoreTSFiles];

const react17TestFileIgnoreList = [
  ignoreTSFiles,
  // We only support Suspense with React 18, so don't test suspense hooks with
  // React 17
  "src/testing/experimental/__tests__/createTestSchema.test.tsx",
  "src/react/hooks/__tests__/useSuspenseQuery.test.tsx",
  "src/react/hooks/__tests__/useBackgroundQuery.test.tsx",
  "src/react/hooks/__tests__/useLoadableQuery.test.tsx",
  "src/react/hooks/__tests__/useQueryRefHandlers.test.tsx",
  "src/react/query-preloader/__tests__/createQueryPreloader.test.tsx",
];

const tsStandardConfig = {
  ...defaults,
  displayName: "Core Tests",
  testPathIgnorePatterns: [ignoreTSXFiles],
};

// For both React (Jest) "projects", ignore core tests (.ts files) as they
// do not import React, to avoid running them twice.
const standardReact19Config = {
  ...defaults,
  displayName: "ReactDOM 19",
  testPathIgnorePatterns: react19TestFileIgnoreList,
};

const standardReact18Config = {
  ...defaults,
  displayName: "ReactDOM 18",
  testPathIgnorePatterns: [ignoreTSFiles],
  moduleNameMapper: {
    "^react$": "react-18",
    "^react-dom$": "react-dom-18",
    "^react-dom/(.*)$": "react-dom-18/$1",
  },
};

const standardReact17Config = {
  ...defaults,
  displayName: "ReactDOM 17",
  testPathIgnorePatterns: react17TestFileIgnoreList,
  moduleNameMapper: {
    "^react$": "react-17",
    "^react-dom$": "react-dom-17",
    "^react-dom/client$": "<rootDir>/../config/jest/react-dom-17-client.js",
    "^react-dom/server$": "react-dom-17/server",
    "^react-dom/test-utils$": "react-dom-17/test-utils",
  },
};

module.exports = {
  projects: [
    tsStandardConfig,
    standardReact17Config,
    standardReact18Config,
    standardReact19Config,
  ],
};
