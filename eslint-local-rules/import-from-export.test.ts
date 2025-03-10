import { resolve } from "node:path";
import {
  importFromExport,
  importFromInsideOtherExport,
} from "./import-from-export.ts";
import { mkRuleTester } from "./testSetup.ts";

const tester = mkRuleTester((config) => {
  config.languageOptions.parserOptions.tsconfigRootDir = resolve(
    import.meta.dirname,
    "../src/core"
  );
  config.languageOptions.parserOptions.project = resolve(
    import.meta.dirname,
    "../tsconfig.json"
  );
  config.defaultFilenames = {
    ts: "ApolloClient.ts",
  };
  return config;
});
tester.run("import-from-exports", importFromExport, {
  valid: [
    `
      import { ApolloLink } from "@apollo/client/link";
    `,
    `
      import { QueryManager } from "./QueryManager.js";
    `,
  ],
  invalid: [
    {
      code: `
        import { ApolloLink } from "../link/core/index.js";
      `,
      errors: [{ messageId: "importFromExport" }],
      output: `
        import { ApolloLink } from "@apollo/client/link/core";
      `,
    },
  ],
});
tester.run("import-from-inside-other-export", importFromInsideOtherExport, {
  valid: [
    `
      import { ApolloLink } from "@apollo/client/link";
    `,
    `
      import { QueryManager } from "./QueryManager.js";
    `,
  ],
  invalid: [
    {
      code: `
        import { ApolloLink } from "../link/core/link.js";
      `,
      errors: [{ messageId: "importFromInsideOtherExport" }],
    },
  ],
});
