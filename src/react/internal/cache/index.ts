export type { SuspenseCacheOptions } from "./SuspenseCache.js";
export type { CacheKey, QueryKey } from "./types.js";
export { getSuspenseCache } from "./getSuspenseCache.js";
export type { QueryReference, QueryRefPromise } from "./QueryReference.js";
export {
  InternalQueryReference,
  unwrapQueryRef,
  wrapQueryRef,
  updateWrappedQueryRef,
  getWrappedPromise,
} from "./QueryReference.js";
