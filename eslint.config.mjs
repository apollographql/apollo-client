import typescriptEslint from "@typescript-eslint/eslint-plugin";
import _import from "eslint-plugin-import";
import localRules from "eslint-plugin-local-rules";
import { fixupPluginRules, fixupConfigRules } from "@eslint/compat";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import reactCompiler from "eslint-plugin-react-compiler";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    plugins: {
      "@typescript-eslint": typescriptEslint,
      import: fixupPluginRules(_import),
      "local-rules": localRules,
    },

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

      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },

    rules: {
      "import/no-unresolved": "error",
    },
  },
  ...fixupConfigRules(compat.extends("plugin:react-hooks/recommended")).map(
    (config) => ({
      ...config,
      files: ["**/*.ts", "**/*.tsx"],
      ignores: ["**/__tests__/**/*.*", "**/*.d.ts"],
    })
  ),
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["**/__tests__/**/*.*", "**/*.d.ts"],

    plugins: {
      "react-compiler": reactCompiler,
    },

    languageOptions: {
      ecmaVersion: 5,
      sourceType: "script",

      parserOptions: {
        project: [
          "./tsconfig.json",
          "./scripts/codemods/data-masking/tsconfig.json",
        ],
      },
    },

    rules: {
      "react-compiler/react-compiler": "error",

      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          disallowTypeAnnotations: false,
          fixStyle: "separate-type-imports",
        },
      ],

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
      ],

      "import/consistent-type-specifier-style": ["error", "prefer-top-level"],

      "import/extensions": [
        "error",
        "always",
        {
          ignorePackages: true,
          checkTypeImports: true,
        },
      ],

      "local-rules/require-using-disposable": "error",
    },
  },
  ...compat.extends("plugin:testing-library/react").map((config) => ({
    ...config,

    files: [
      "**/__tests__/**/*.[jt]s",
      "**/__tests__/**/*.[jt]sx",
      "**/?(*.)+(test).[jt]s",
      "**/?(*.)+(test).[jt]sx",
    ],
  })),
  {
    files: [
      "**/__tests__/**/*.[jt]s",
      "**/__tests__/**/*.[jt]sx",
      "**/?(*.)+(test).[jt]s",
      "**/?(*.)+(test).[jt]sx",
    ],

    languageOptions: {
      ecmaVersion: 5,
      sourceType: "script",

      parserOptions: {
        project: "./tsconfig.tests.json",
      },
    },

    rules: {
      "testing-library/prefer-user-event": "error",
      "testing-library/no-wait-for-multiple-assertions": "off",
      "local-rules/require-using-disposable": "error",
      "local-rules/require-disable-act-environment": "error",
      "local-rules/forbid-act-in-disabled-act-environment": "error",
      "@typescript-eslint/no-floating-promises": "warn",
    },
  },
];
