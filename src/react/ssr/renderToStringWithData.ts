import type * as ReactTypes from "react";

import { prerenderStatic } from "./prerenderStatic.js";

/**
 * @deprecated This function uses the legacy `renderToString` API from React.
 * Use `prerenderStatic` instead, which can be configured to run with more modern
 * React APIs.
 */
export async function renderToStringWithData(
  component: ReactTypes.ReactElement<any>
): Promise<string> {
  const { result } = await prerenderStatic({
    tree: component,
    renderFunction: (await import("react-dom/server")).renderToString,
    maxRerenders: Number.POSITIVE_INFINITY,
  });
  return result;
}
