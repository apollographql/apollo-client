// @ts-check
import { RuleTester } from "@typescript-eslint/rule-tester";
import { rule } from "./require-using-disposable.mjs";
import nodeTest from "node:test";

RuleTester.it = nodeTest.it;
RuleTester.itOnly = nodeTest.only;
RuleTester.describe = nodeTest.describe;
RuleTester.afterAll = nodeTest.after;

const ruleTester = new RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname + "/fixtures",
  },
});
ruleTester.run("my-typed-rule", rule, {
  valid: [
    `
    function foo(): Disposable {}
    using bar = foo()
    `,
    `
    function foo(): AsyncDisposable {}
    await using bar = foo()
    `,
  ],
  invalid: [
    {
      code: `
      function foo(): Disposable {}
      const bar = foo()
      `,
      errors: [{ messageId: "missingUsing" }],
    },
    {
      code: `
      function foo(): AsyncDisposable {}
      const bar = foo()
      `,
      errors: [{ messageId: "missingAwaitUsing" }],
    },
  ],
});
