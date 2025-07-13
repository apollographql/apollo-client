import { withCleanup } from "./withCleanup.js";

export function withProdMode() {
  const prev = { prevDEV: __DEV__ };
  Object.defineProperty(globalThis, "__DEV__", { value: false });

  return withCleanup(prev, ({ prevDEV }) => {
    Object.defineProperty(globalThis, "__DEV__", { value: prevDEV });
  });
}
