// This is a helper required for React 19 testing.
// There are currently multiple directions this could play out in RTL and none of
// them has been released yet, so we are inlining this helper for now.
// See https://github.com/testing-library/react-testing-library/pull/1214
// and https://github.com/testing-library/react-testing-library/pull/1365

import type { queries, Queries } from "@testing-library/dom";
import type {
  RenderHookOptions,
  RenderHookResult,
} from "@testing-library/react";
import type * as ReactDOMClient from "react-dom/client";
import * as ReactDOM from "react-dom";
import * as React from "react";
import { renderAsync } from "./renderAsync.js";

type RendererableContainer = ReactDOMClient.Container;
type HydrateableContainer = Parameters<
  (typeof ReactDOMClient)["hydrateRoot"]
>[0];

export async function renderHookAsync<
  Result,
  Props,
  Q extends Queries = typeof queries,
  Container extends RendererableContainer | HydrateableContainer = HTMLElement,
  BaseElement extends RendererableContainer | HydrateableContainer = Container,
>(
  renderCallback: (initialProps: Props) => Result,
  options: RenderHookOptions<Props, Q, Container, BaseElement> | undefined = {}
): Promise<RenderHookResult<Result, Props>> {
  const { initialProps, ...renderOptions } = options;

  // @ts-expect-error
  if (renderOptions.legacyRoot && typeof ReactDOM.render !== "function") {
    const error = new Error(
      "`legacyRoot: true` is not supported in this version of React. " +
        "If your app runs React 19 or later, you should remove this flag. " +
        "If your app runs React 18 or earlier, visit https://react.dev/blog/2022/03/08/react-18-upgrade-guide for upgrade instructions."
    );
    Error.captureStackTrace(error, renderHookAsync);
    throw error;
  }

  const result = React.createRef<Result>() as { current: Result };

  function TestComponent({
    renderCallbackProps,
  }: {
    renderCallbackProps: Props;
  }) {
    const pendingResult = renderCallback(renderCallbackProps);

    React.useEffect(() => {
      result.current = pendingResult;
    });

    return null;
  }

  const { rerender: baseRerender, unmount } = await renderAsync(
    <TestComponent renderCallbackProps={initialProps!} />,
    renderOptions
  );

  function rerender(rerenderCallbackProps?: Props) {
    return baseRerender(
      <TestComponent renderCallbackProps={rerenderCallbackProps!} />
    );
  }

  return { result, rerender, unmount };
}
