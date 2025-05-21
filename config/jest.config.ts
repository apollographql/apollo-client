import { join } from "node:path";
import { fileURLToPath } from "node:url";

const defaults = {
  rootDir: "src",
  preset: "ts-jest",
  testEnvironment: fileURLToPath(
    import.meta.resolve("./FixJSDOMEnvironment.js")
  ),
  setupFilesAfterEnv: ["<rootDir>/config/jest/setup.ts"],
  testEnvironmentOptions: {
    url: "http://localhost",
  },
  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true,
  },
  transform: {
    "(dist/.+\\.js|\\.tsx?)$": [
      "ts-jest",
      {
        // just transpile, no type checking. We type-check in CI by running `tsc` directly.
        isolatedModules: true,
        tsconfig: join(import.meta.dirname, "..", "tsconfig.tests.json"),
      },
    ],
  },
  resolver: "<rootDir>/config/jest/resolver.ts",
  prettierPath: null,
};

const ignoreDTSFiles = ".d.ts$";
const ignoreTSFiles = ".ts$";
const ignoreTSXFiles = ".tsx$";

const react19TestFileIgnoreList = [ignoreDTSFiles, ignoreTSFiles];

const react17TestFileIgnoreList = [
  ignoreDTSFiles,
  ignoreTSFiles,
  // We only support Suspense with React 18, so don't test suspense hooks with
  // React 17
  "src/testing/experimental/__tests__/createTestSchema.test.tsx",
  "src/react/hooks/__tests__/useSuspenseFragment.test.tsx",
  "src/react/hooks/__tests__/useSuspenseQuery.test.tsx",
  "src/react/hooks/__tests__/useBackgroundQuery.test.tsx",
  "src/react/hooks/__tests__/useLoadableQuery.test.tsx",
  "src/react/hooks/__tests__/useQueryRefHandlers.test.tsx",
  "src/react/query-preloader/__tests__/createQueryPreloader.test.tsx",
  "src/react/ssr/__tests__/prerenderStatic.test.tsx",
];

const tsStandardConfig = {
  ...defaults,
  displayName: "Core Tests",
  testPathIgnorePatterns: [
    ignoreDTSFiles,
    ignoreTSXFiles,
    "src/local-state/__tests__/LocalState/testUtils.ts",
    "src/local-state/__tests__/LocalState/fixtures/.*.ts$",
  ],
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
  testPathIgnorePatterns: [
    ignoreDTSFiles,
    ignoreTSFiles,
    "src/react/ssr/__tests__/prerenderStatic.test.tsx",
  ],
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

export default {
  projects: [
    tsStandardConfig,
    standardReact17Config,
    standardReact18Config,
    standardReact19Config,
  ],
};
