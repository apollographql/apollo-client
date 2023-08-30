import {
  invariant,
  newInvariantError,
  InvariantError,
} from "./invariantWrappers.js";

export { maybe } from "./maybe.js";
export { default as global } from "./global.js";
export { invariant, newInvariantError, InvariantError };

/**
 * @deprecated we do not use this internally anymore,
 * it is just exported for backwards compatibility
 */
// this file is extempt from automatic `__DEV__` replacement
// so we have to write it out here
// @ts-ignore
export const DEV = globalThis.__DEV__ !== false;
export { DEV as __DEV__ };
