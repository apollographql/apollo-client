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

function breakReact19InternalsTemporarily() {
  const R = React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: any;
  };
  const orig =
    R.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

  R.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = {};
  return withCleanup({}, () => {
    R.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = orig;
  });
}

it("results in false negatives if React internals change", () => {
  let result: boolean | typeof UNDEF = UNDEF;
  function TestComponent() {
    using _ = breakReact19InternalsTemporarily();
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
    using _ = breakReact19InternalsTemporarily();
    const calledDuringRender = useRenderGuard();
    useEffect(() => {
      using _ = breakReact19InternalsTemporarily();
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
