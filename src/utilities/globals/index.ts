import { invariant, newInvariantError, InvariantError } from "./invariantWrappers";

// Import graphql/jsutils/instanceOf safely, working around its unchecked usage
// of process.env.NODE_ENV and https://github.com/graphql/graphql-js/pull/2894.
import { removeTemporaryGlobals } from "./fix-graphql";

// Synchronously undo the global process.env.NODE_ENV polyfill that we created
// temporarily while importing the offending graphql/jsutils/instanceOf module.
removeTemporaryGlobals();

export { maybe } from "./maybe";
export { default as global } from "./global";
export { invariant, newInvariantError, InvariantError }

/** 
 * @deprecated we do not use this internally anymore, 
 * it is just exported for backwards compatbility 
 */
// this file is extempt from automatic `__DEV__` replacement 
// so we have to write it out here 
// @ts-ignore
export const DEV = globalThis.__DEV__ !== false;
export { DEV as __DEV__ };