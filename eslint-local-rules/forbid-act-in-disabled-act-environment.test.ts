import { rule } from "./forbid-act-in-disabled-act-environment.ts";
import { ruleTester } from "./testSetup.ts";

ruleTester.run("forbid-act-in-disabled-act-environment", rule, {
  valid: [
    `
  () => {
    using _disabledAct = disableActEnvironment();
  }
  () => {
    act(() => {})
  }
    `,
    `
  () => {
    using _disabledAct = disableActEnvironment();
  }
  () => {
    actAsync(() => {})
  }
    `,
  ],
  invalid: [
    `
    () => {
      using _disabledAct = disableActEnvironment();
      act(() => {})
    }
      `,
    `
    () => {
      using _disabledAct = disableActEnvironment();
      actAsync(() => {})
    }
    `,
    `
    () => {
      using _disabledAct = disableActEnvironment();
      () => {
        act(() => {})
      }
    }
      `,
    `
    () => {
      using _disabledAct = disableActEnvironment();
      () => {
        actAsync(() => {})
      }
    }
    `,
  ].map((code) => ({
    code,
    errors: [{ messageId: "forbiddenActInNonActEnvironment" }],
  })),
});
