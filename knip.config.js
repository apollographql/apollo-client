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
  ignoreDependencies: [
    "@microsoft/api-extractor",
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
    // used by `eslint-local-rules`
    "@tsconfig/node20",
  ],
  jest: {
    config: "config/jest.config.js",
    entry: [
      "src/config/jest/setup.ts",
      "src/testing/matchers/index.d.ts",
      "**/__tests__/**/*.[jt]s?(x)",
      "src/**/__benches__/*.bench.ts",
    ],
  },
};

export default config;
