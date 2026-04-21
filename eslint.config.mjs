if (!process.features.typescript) {
  throw new Error(
    `
    This configuration requires TypeScript support.
    Run node with --experimental-strip-types.

    If using VSCode, add the following to your settings.json
    and reload the window (restarting the ESLint Server might not be enough):
      "eslint.runtime": "/opt/homebrew/bin/node",
      "eslint.execArgv": [ "--experimental-strip-types" ]
    `
  );
}

import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import * as mdx from "eslint-plugin-mdx";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import testingLibrary from "eslint-plugin-testing-library";

import localRules from "./eslint-local-rules/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Some rules can be very costly so we only want to run them from CLI, not from the LSP.
 */
const runExtendedRules = !!process.env.EXTENDED_RULES;

/** @type {Record<string, import("eslint").ESLint.Plugin>} */
const tsPlugins = {
  import: importPlugin,
  "local-rules": {
    rules: localRules,
  },
  // @ts-ignore - slight mismatch between old and new ESLint plugin types
  "@typescript-eslint": typescriptEslint,
};

export default defineConfig([
  globalIgnores(["integration-tests/"]),
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: tsPlugins,
    ignores: ["tests.codegen.ts"],

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },

      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "commonjs",
    },

    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"],
      },
      "import/internal-regex": "^@apollo/client",
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },

    // rules for the whole repo
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@wry/equality",
              importNames: ["default"],
              message:
                "Please use named export `{ equal }` from @wry/equality instead.",
            },
          ],
        },
      ],
      "import/no-unresolved": "error",
      "import/order": [
        "warn",
        {
          "newlines-between": "always",
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          alphabetize: {
            order: "asc",
            orderImportKind: "asc",
            caseInsensitive: true,
          },
          named: true,
        },
      ],
      "local-rules/import-from-export": "error",
      "local-rules/import-from-inside-other-export": [
        "warn",
        {
          ignoreFrom: [
            "src/version.js",
            "src/invariantErrorCodes.js",
            "src/utilities/caching/getMemoryInternals.js",
            "src/utilities/types/TODO.js",
            "src/utilities/caching/sizes.js",
          ].map((file) => path.resolve(__dirname, file)),
        },
      ],
      "local-rules/no-duplicate-exports": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          disallowTypeAnnotations: false,
          fixStyle: "separate-type-imports",
        },
      ],
      "@typescript-eslint/no-namespace": [
        "error",
        {
          allowDeclarations: true,
        },
      ],
    },
  },
  {
    ...reactHooks.configs.flat["recommended-latest"],
    files: ["src/react/**/*.ts", "src/react/**/*.tsx"],
    ignores: ["**/__tests__/**/*.*", "**/*.d.ts"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["**/__tests__/**/*.*", "**/*.d.ts"],

    plugins: {
      ...tsPlugins,
    },

    languageOptions: {
      ecmaVersion: 5,
      sourceType: "script",

      parserOptions: {
        project: [
          "./tsconfig.json",
          "./codegen/tsconfig.json",
          "./config/tsconfig.json",
          "./docs/tsconfig.json",
          "./eslint-local-rules/tsconfig.json",
          "./scripts/codemods/data-masking/tsconfig.json",
          "./scripts/codemods/ac3-to-ac4/tsconfig.json",
        ],
      },
    },

    // rules for source files, but no tests
    rules: {
      "@typescript-eslint/consistent-type-exports": ["error"],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-restricted-types": [
        "error",
        {
          types: {
            GraphQLError: {
              message: "Use GraphQLFormattedError instead",
              fixWith: "GraphQLFormattedError",
            },

            ExecutionResult: {
              message: "Use FormattedExecutionResult instead",
              fixWith: "FormattedExecutionResult",
            },
          },
        },
      ],

      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportDeclaration[source.value='react'][importKind!='type'] :matches(ImportSpecifier, ImportDefaultSpecifier)",
          message:
            "Please only use the namespace import syntax (`import * as React from 'react'`) for React imports!",
        },
        "ExportAllDeclaration",
      ],

      "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
      "local-rules/require-using-disposable": "error",
      "local-rules/valid-inherit-doc": "error",
      "local-rules/variables-should-extend-operation-variables": "error",
      "local-rules/tdata-tvariables-order": "error",
    },
  },
  {
    files: [
      "**/__tests__/**/*.[jt]s",
      "**/__tests__/**/*.[jt]sx",
      "**/?(*.)+(test).[jt]s",
      "**/?(*.)+(test).[jt]sx",
    ],
    ...testingLibrary.configs["flat/react"],
  },
  {
    files: [
      "**/__tests__/**/*.[jt]s",
      "**/__tests__/**/*.[jt]sx",
      "**/?(*.)+(test).[jt]s",
      "**/?(*.)+(test).[jt]sx",
    ],

    plugins: tsPlugins,
    languageOptions: {
      ecmaVersion: 5,
      sourceType: "script",

      parserOptions: {
        project: [
          "./tsconfig.tests.json",
          "./eslint-local-rules/tsconfig.json",
          "./scripts/codemods/ac3-to-ac4/tsconfig.tests.json",
        ],
      },
    },

    // rules for tests only
    rules: {
      "testing-library/prefer-user-event": "error",
      "testing-library/no-wait-for-multiple-assertions": "off",
      "local-rules/require-using-disposable": "error",
      "local-rules/require-disable-act-environment": "error",
      "local-rules/forbid-act-in-disabled-act-environment": "error",
      "local-rules/import-from-inside-other-export": "off",
      "local-rules/no-internal-import-official-export":
        runExtendedRules ? "error" : "off",
      "local-rules/no-relative-imports": [
        "error",
        {
          ignoreFrom: ["src/utilities/caching/sizes.js"].map((file) =>
            path.resolve(__dirname, file)
          ),
        },
      ],
      "import/no-duplicates": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
    },
  },
  {
    files: ["scripts/codemods/ac3-to-ac4/**/__tests__/**/*.ts"],
    // rules for tests only
    rules: {
      "local-rules/no-relative-imports": "off",
    },
  },
  {
    basePath: "docs",
    ...mdx.flat,
    plugins: {
      ...mdx.flat.plugins,
      "local-rules": {
        rules: localRules,
      },
    },
    rules: {
      "local-rules/mdx-valid-canonical-references": "error",
    },
  },
  {
    basePath: "docs",
    ...mdx.flatCodeBlocks,
  },
]);
