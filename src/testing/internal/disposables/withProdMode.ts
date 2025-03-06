import { withCleanup } from "./withCleanup.js";

import * as environment from "@apollo/client/utilities/environment";

export function withProdMode() {
  const prev = { prevDEV: environment.__DEV__ };
  Object.defineProperty(environment, "__DEV__", {
    value: false,
    configurable: true,
  });

  return withCleanup(prev, ({ prevDEV }) => {
    Object.defineProperty(environment, "__DEV__", { value: prevDEV });
  });
}
