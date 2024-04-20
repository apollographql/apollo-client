/* eslint-disable testing-library/render-result-naming-convention */
import React, { useEffect } from "react";
import { useRenderGuard } from "../useRenderGuard";
import { render, waitFor } from "@testing-library/react";
import { withCleanup } from "../../../../testing/internal";

const UNDEF = {};

it("returns a function that returns `true` if called during render", () => {
  let result: boolean | typeof UNDEF = UNDEF;
  function TestComponent() {
    const calledDuringRender = useRenderGuard();
    result = calledDuringRender();
    return <>Test</>;
  }
  render(<TestComponent />);
  expect(result).toBe(true);
});

it("returns a function that returns `false` if called after render", async () => {
  let result: boolean | typeof UNDEF = UNDEF;
  function TestComponent() {
    const calledDuringRender = useRenderGuard();
    useEffect(() => {
      result = calledDuringRender();
    });
    return <>Test</>;
  }
  render(<TestComponent />);
  await waitFor(() => {
    expect(result).not.toBe(UNDEF);
  });
  expect(result).toBe(false);
});

function breakReactInternalsTemporarily() {
  const R = React as unknown as {
    __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: any;
  };
  const orig = R.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

  R.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {};
  return withCleanup({}, () => {
    R.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = orig;
  });
}

it("results in false negatives if React internals change", () => {
  let result: boolean | typeof UNDEF = UNDEF;
  function TestComponent() {
    using _ = breakReactInternalsTemporarily();
    const calledDuringRender = useRenderGuard();
    result = calledDuringRender();
    return <>Test</>;
  }
  render(<TestComponent />);
  expect(result).toBe(false);
});

it("does not result in false positives if React internals change", async () => {
  let result: boolean | typeof UNDEF = UNDEF;
  function TestComponent() {
    using _ = breakReactInternalsTemporarily();
    const calledDuringRender = useRenderGuard();
    useEffect(() => {
      using _ = breakReactInternalsTemporarily();
      result = calledDuringRender();
    });
    return <>Test</>;
  }
  render(<TestComponent />);
  await waitFor(() => {
    expect(result).not.toBe(UNDEF);
  });
  expect(result).toBe(false);
});
