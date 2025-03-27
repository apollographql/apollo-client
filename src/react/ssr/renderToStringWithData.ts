import type * as ReactTypes from "react";

import { prerenderStatic } from "./prerenderStatic.js";

export async function renderToStringWithData(
  component: ReactTypes.ReactElement<any>
): Promise<string> {
  const { result } = await prerenderStatic({
    tree: component,
    renderFunction: (await import("react-dom/server")).renderToString,
  });
  return result;
}
