export { getSuspenseCache } from "./cache/getSuspenseCache.js";
export type { CacheKey, FragmentKey, QueryKey } from "./cache/types.js";
export type { PreloadedQueryRef, QueryRef } from "./cache/QueryReference.js";
export {
  assertWrappedQueryRef,
  getWrappedPromise,
  InternalQueryReference,
  unwrapQueryRef,
  updateWrappedQueryRef,
  wrapQueryRef,
} from "./cache/QueryReference.js";
export type { SuspenseCacheOptions } from "./cache/SuspenseCache.js";
// eslint-disable-next-line local-rules/import-from-inside-other-export
export type { HookWrappers } from "../hooks/internal/wrapHook.js";
// eslint-disable-next-line local-rules/import-from-inside-other-export
export { wrapperSymbol } from "../hooks/internal/wrapHook.js";
export type { FetchMoreFunction, RefetchFunction } from "./types.js";
