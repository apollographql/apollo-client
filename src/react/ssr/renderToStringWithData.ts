import type * as ReactTypes from "react";
import { getMarkupFromTree } from "./getDataFromTree.js";
import { renderToString } from "react-dom/server";
import type { BatchOptions } from "./types.js";

export function renderToStringWithData(
  component: ReactTypes.ReactElement<any>,
  batchOptions?: BatchOptions
): Promise<string> {
  return getMarkupFromTree({
    tree: component,
    renderFunction: renderToString,
    batchOptions,
  });
}
