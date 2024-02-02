import { withCleanup } from "./withCleanup.js";

/**
 * Temporarily disable act warnings.
 *
 * https://github.com/reactwg/react-18/discussions/102
 */
export function disableActWarnings() {
  const prev = { prevActEnv: (globalThis as any).IS_REACT_ACT_ENVIRONMENT };
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;

  return withCleanup(prev, ({ prevActEnv }) => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = prevActEnv;
  });
}
