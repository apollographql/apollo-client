/* eslint-disable testing-library/render-result-naming-convention */
import React, { useEffect } from "rehackt";
import { useRenderGuard } from "../useRenderGuard";
import { render, waitFor } from "@testing-library/react";

const UNDEF = {};
const IS_REACT_19 = React.version.startsWith("19");

it("returns a function that returns `true` if called during render", () => {
  // We don't provide this functionality with React 19 anymore since it requires internals access
  if (IS_REACT_19) return;
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
