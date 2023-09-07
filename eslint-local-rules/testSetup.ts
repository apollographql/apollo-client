import { RuleTester } from "@typescript-eslint/rule-tester";
import nodeTest from "node:test";

RuleTester.it = nodeTest.it;
RuleTester.itOnly = nodeTest.only;
RuleTester.describe = nodeTest.describe;
RuleTester.afterAll = nodeTest.after;

export const ruleTester = new RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname + "/fixtures",
  },
});
