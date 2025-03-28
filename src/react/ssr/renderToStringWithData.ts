import type * as ReactTypes from "react";
import { renderToString } from "react-dom/server";

import { getMarkupFromTree } from "./getDataFromTree.js";

export function renderToStringWithData(
  component: ReactTypes.ReactElement<any>
): Promise<string> {
  return getMarkupFromTree({
    tree: component,
    renderFunction: renderToString,
  });
}
