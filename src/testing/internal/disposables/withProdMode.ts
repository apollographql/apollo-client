import { withCleanup } from "./withCleanup.js";
declare const __DEV__: boolean;
export function withProdMode() {
  const prev = { prevDEV: __DEV__ };
  Object.defineProperty(globalThis, "__DEV__", { value: false });

  return withCleanup(prev, ({ prevDEV }) => {
    Object.defineProperty(globalThis, "__DEV__", { value: prevDEV });
  });
}
