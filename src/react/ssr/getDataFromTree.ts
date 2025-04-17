import type * as ReactTypes from "react";

import { prerenderStatic } from "./prerenderStatic.js";

/**
 * @deprecated This function uses the legacy `renderToStaticMarkup` API from React.
 * Use `prerenderStatic` instead, which can be configured to run with more modern
 * React APIs.
 */
export async function getDataFromTree(
  tree: ReactTypes.ReactNode,
  context: { [key: string]: any } = {}
) {
  return getMarkupFromTree({
    tree,
    context,
    // If you need to configure this renderFunction, call getMarkupFromTree
    // directly instead of getDataFromTree.
    renderFunction: (await import("react-dom/server")).renderToStaticMarkup,
  });
}

type GetMarkupFromTreeOptions = {
  tree: ReactTypes.ReactNode;
  context?: { [key: string]: any };
  renderFunction?:
    | prerenderStatic.RenderToString
    | prerenderStatic.RenderToStringPromise;
};

/**
 * @deprecated This function is only compatible with legacy React prerendering APIs.
 * Use `prerenderStatic` instead, which can be configured to run with more modern
 * React APIs.
 */
export async function getMarkupFromTree({
  tree,
  context = {},
  // The rendering function is configurable! We use renderToStaticMarkup as
  // the default, because it's a little less expensive than renderToString,
  // and legacy usage of getDataFromTree ignores the return value anyway.
  renderFunction,
}: GetMarkupFromTreeOptions): Promise<string> {
  if (!renderFunction) {
    renderFunction = (await import("react-dom/server")).renderToStaticMarkup;
  }
  const { result } = await prerenderStatic({
    tree,
    context,
    renderFunction,
    maxRerenders: Number.POSITIVE_INFINITY,
  });
  return result;
}
