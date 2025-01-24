import { RuleTester } from "@typescript-eslint/rule-tester";
import tsParser from "@typescript-eslint/parser";
import nodeTest from "node:test";

RuleTester.it = nodeTest.it;
RuleTester.itOnly = nodeTest.only;
RuleTester.describe = nodeTest.describe;
RuleTester.afterAll = nodeTest.after;

export const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      project: "./tsconfig.json",
      tsconfigRootDir: import.meta.dirname + "/fixtures",
    },
  },
});
