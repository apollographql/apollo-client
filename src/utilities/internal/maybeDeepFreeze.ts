import { __DEV__ } from "@apollo/client/utilities/environment";

import { deepFreeze } from "./deepFreeze.js";

/** @internal */
export function maybeDeepFreeze<T>(obj: T): T {
  if (__DEV__) {
    deepFreeze(obj);
  }
  return obj;
}
