// @ts-check

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { entryPoints } from "./config/entryPoints.js";

const packageJSON = JSON.parse(readFileSync("package.json", "utf-8"));

const packageEntries = entryPoints.map(({ dirs }) =>
  join("src", ...dirs, "index.ts")
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
  exclude: ["optionalPeerDependencies", "unresolved"],
  entry: []
    .concat(packageEntries)
    .concat(scriptEntries)
    .concat([
      "src/cache/inmemory/fixPolyfills.native.ts",
      "src/react/types/types.documentation.ts",
      "eslint-local-rules/index.mjs",
      "codegen/local-state/index.ts",
      "codegen/local-state/config.ts",
      "codegen/local-state/plugin.ts",
      "codegen/local-state/visitor.ts",
      "scripts/codemods/ac3-to-ac4/src/util/getAllExports.ts",
    ]),
  project: [
    "src/**/*.ts{,x}",
    "config/*.{,c}[jt]s",
    "eslint-local-rules/*.[jt]s",
  ],
  ignore: [
    "integration-tests/**/*",
    ".yalc/**/*",
    "config/schema.package.json.ts",
    "src/config/jest/resolver.ts",
    "config/listImports.ts",
    "scripts/codemods/**/__testfixtures__/**/*",
  ],
  ignoreBinaries: ["jq"],
  ignoreDependencies: [
    /@actions\/.*/,
    /@size-limit\/.*/,
    "size-limit-apollo-plugin",
    /eslint-.*/,
    // used by `recast`
    "@babel/parser",
    // called in a script, but with `xargs`
    "tsx",
    // TS types referenced by "rollup-plugin-terser"
    "terser",
    // used as a reporter by the `test:coverage` script
    "jest-junit",
    "@mdx-js/language-service",
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
      "eslint-local-rules/tsconfig.json",
      "config/tsconfig.json",
    ],
  },
};

export default config;
