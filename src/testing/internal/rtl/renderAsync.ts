// This is a helper required for React 19 testing.
// There are currently multiple directions this could play out in RTL and none of
// them has been released yet, so we are inlining this helper for now.
// See https://github.com/testing-library/react-testing-library/pull/1214
// and https://github.com/testing-library/react-testing-library/pull/1365

import type { queries, Queries } from "@testing-library/dom";
import type { RenderOptions, RenderResult } from "@testing-library/react";
import { act, render } from "@testing-library/react";
import type * as ReactDOMClient from "react-dom/client";

type RendererableContainer = ReactDOMClient.Container;
type HydrateableContainer = Parameters<
  (typeof ReactDOMClient)["hydrateRoot"]
>[0];

export function renderAsync<
  Q extends Queries = typeof queries,
  Container extends RendererableContainer | HydrateableContainer = HTMLElement,
  BaseElement extends RendererableContainer | HydrateableContainer = Container,
>(
  ui: React.ReactNode,
  options: RenderOptions<Q, Container, BaseElement>
): Promise<RenderResult<Q, Container, BaseElement>>;
export function renderAsync(
  ui: React.ReactNode,
  options?: Omit<RenderOptions, "queries"> | undefined
): Promise<RenderResult>;

export function renderAsync(...args: [any, any]): any {
  return act(async () => {
    return await render(...args);
  });
}
