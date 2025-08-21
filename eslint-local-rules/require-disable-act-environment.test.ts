import { rule } from "./require-disable-act-environment.ts";
import { ruleTester } from "./testSetup.ts";

ruleTester.run("require-disable-act-environment", rule, {
  valid: [
    `
  () => {
    using _disabledAct = disableActEnvironment();
    const { takeRender } = someCall()
    const {} = takeRender()
  }
    `,
    `
  () => {
    using _disabledAct = disableActEnvironment();
    const {} = renderStream.takeRender()
  }
    `,
    `
  () => {
    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = someCall()
    const {} = takeSnapshot()
  }
    `,
    `
  () => {
    using _disabledAct = disableActEnvironment();
    const {} = renderStream.takeSnapshot()
  }
    `,
    `
  using _disabledAct = disableActEnvironment();
  () => {
    const { takeRender } = someCall()
    const {} = takeRender()
  }
    `,
    `
  using _disabledAct = disableActEnvironment();
  () => {
    const {} = renderStream.takeRender()
  }
    `,
    `
  using _disabledAct = disableActEnvironment();
  () => {
    const { takeSnapshot } = someCall()
    const {} = takeSnapshot()
  }
    `,
    `
  using _disabledAct = disableActEnvironment();
  () => {
    const {} = renderStream.takeSnapshot()
  }
    `,
  ],
  invalid: [
    `
    () => {
      using _disabledAct = disableActEnvironment();
    }
    () => {
      const { takeRender } = someCall()
      takeRender()
    }
    `,
    `
    () => {
      using _disabledAct = disableActEnvironment();
    }
    () => {
      renderStream.takeRender()
    }
    `,
    `
    () => {
      using _disabledAct = disableActEnvironment();
    }
    () => {
      const { takeSnapshot } = someCall()
      takeSnapshot()
    }
    `,
    `
    () => {
      using _disabledAct = disableActEnvironment();
    }
    () => {
      renderStream.takeSnapshot()
    }
    `,
    `
    () => {
      const { takeRender } = someCall()
      takeRender()
    }
    `,
    `
    () => {
      renderStream.takeRender()
    }
    `,
    `
    () => {
      const { takeSnapshot } = someCall()
      takeSnapshot()
    }
    `,
    `
    () => {
      renderStream.takeSnapshot()
    }
    `,
  ].map((code) => ({
    code,
    errors: [{ messageId: "missingDisableActEnvironment" }],
  })),
});
