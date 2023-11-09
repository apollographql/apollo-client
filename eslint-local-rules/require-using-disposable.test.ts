import { rule } from "./require-using-disposable";
import { ruleTester } from "./testSetup";

ruleTester.run("require-using-disposable", rule, {
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
