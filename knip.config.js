// @ts-check

import { join } from "node:path";
import { map } from "./config/entryPoints.js";
import { readFileSync } from "node:fs";

const packageJSON = JSON.parse(readFileSync("package.json", "utf-8"));

const packageEntries = map(({ dirs, bundleName = "index.ts" }) =>
  join("src", ...dirs, bundleName)
);

const scriptEntries = Array.from(
  Object.values(packageJSON.scripts)
    .join("\n")
    .matchAll(/(config\/.*?\.[jt]s)/g)
)
  .map((match) => match[1])
  .filter((value, index, arr) => index === arr.indexOf(value));

/** @type{import('knip').KnipConfig}*/
const config = {
  exclude: ["optionalPeerDependencies"],
  entry: []
    .concat(packageEntries)
    .concat(scriptEntries)
    .concat([
      "src/cache/inmemory/fixPolyfills.native.ts",
      "src/react/types/types.documentation.ts",
      "eslint-local-rules/require-using-disposable.ts",
    ]),
  project: ["src/**/*.ts", "config/*.js"],
  ignore: ["integration-tests/**/*", ".yalc/**/*"],
  ignoreBinaries: ["jq"],
  ignoreDependencies: [
    /@size-limit\/.*/,
    /@typescript-eslint\/.*/,
    /eslint-.*/,
    // used by `recast`
    "@babel/parser",
    // called in a script, but with `xargs`
    "tsx",
    // TS types referenced by "rollup-plugin-terser"
    "terser",
    // used as a reporter by the `test:coverage` script
    "jest-junit",
  ],
  jest: {
    config: "config/jest.config.js",
    entry: [
      "src/config/jest/setup.ts",
      "src/testing/matchers/index.d.ts",
      "**/__tests__/**/*.[jt]s?(x)",
      "**/*.test.[jt]s?(x)",
      "src/**/__benches__/*.bench.ts",
    ],
  },
  typescript: {
    config: [
      "tsconfig.json",
      "src/tsconfig.json",
      "eslint-local-rules/tsconfig.json",
    ],
  },
};

export default config;
