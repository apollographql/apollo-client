export { getSuspenseCache } from "./cache/getSuspenseCache.js";
export type { CacheKey, QueryKey } from "./cache/types.js";
export type { QueryReference } from "./cache/QueryReference.js";
export {
  InternalQueryReference,
  getWrappedPromise,
  unwrapQueryRef,
  updateWrappedQueryRef,
  wrapQueryRef,
} from "./cache/QueryReference.js";
export type { SuspenseCacheOptions } from "./cache/SuspenseCache.js";
export type { HookWrappers } from "../hooks/internal/wrapHook.js";
