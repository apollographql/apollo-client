import { withCleanup } from "./withCleanup.js";

export function withProdMode() {
  const prev = { prevDEV: __DEV__ };
  (globalThis as any).__DEV__ = false;

  return withCleanup(prev, ({ prevDEV }) => {
    (globalThis as any).__DEV__ = prevDEV;
  });
}
