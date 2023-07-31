export type { SuspenseCacheOptions } from "./SuspenseCache.js";
export { getSuspenseCache } from "./getSuspenseCache.js";

import { SuspenseCache as RealSuspenseCache } from "./SuspenseCache.js";

// TODO: remove export with release 3.8
// replace with
// export type { SuspenseCache } from './SuspenseCache.js';
/**
 * @deprecated
 * It is no longer necessary to create a `SuspenseCache` instance and pass it into the `ApolloProvider`.
 * Please remove this code from your application.
 *
 * This export will be removed with the final 3.8 release.
 */
export class SuspenseCache extends RealSuspenseCache {
  constructor() {
    super();
    // throwing an error here instead of using invariant - we do not want this error
    // message to be link-ified, but to directly show up as bold as possible
    throw new Error(
      "It is no longer necessary to create a `SuspenseCache` instance and pass it into the `ApolloProvider`.\n" +
        "Please remove this code from your application. \n\n" +
        "This export will be removed with the final 3.8 release."
    );
  }
}
