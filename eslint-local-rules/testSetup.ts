import { RuleTester } from "@typescript-eslint/rule-tester";
import type { RuleTesterConfig } from "@typescript-eslint/rule-tester";
import tsParser from "@typescript-eslint/parser";
import nodeTest from "node:test";

RuleTester.it = nodeTest.it;
RuleTester.itOnly = nodeTest.only;
RuleTester.describe = nodeTest.describe;
RuleTester.afterAll = nodeTest.after;

export function mkRuleTester(
  wrap: (testerConfig: RuleTesterConfig) => RuleTesterConfig = (x) => x
) {
  return new RuleTester(
    wrap({
      languageOptions: {
        parser: tsParser,
        parserOptions: {
          project: "../tsconfig.json",
          tsconfigRootDir: import.meta.dirname + "/fixtures",
        },
      },
    })
  );
}

export const ruleTester = mkRuleTester();
