export { getSuspenseCache } from "./cache/getSuspenseCache.js";
export type { CacheKey, QueryKey } from "./cache/types.js";
export type {
  PreloadedQueryRef,
  QueryRef,
  QueryReference,
} from "./cache/QueryReference.js";
export {
  assertWrappedQueryRef,
  getWrappedPromise,
  InternalQueryReference,
  unwrapQueryRef,
  updateWrappedQueryRef,
  wrapQueryRef,
} from "./cache/QueryReference.js";
export type { SuspenseCacheOptions } from "./cache/SuspenseCache.js";
export type { HookWrappers } from "../hooks/internal/wrapHook.js";
export { wrapperSymbol } from "../hooks/internal/wrapHook.js";
export type {
  FetchMoreFunction,
  RefetchFunction,
  VariablesOption,
} from "./types.js";
