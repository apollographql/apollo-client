import type { InternalTypes as ReactInternalTypes } from "@apollo/client/react";
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
export type HookWrappers = ReactInternalTypes.HookWrappers;
export const wrapperSymbol = Symbol.for("apollo.hook.wrappers");
export type { FetchMoreFunction, RefetchFunction } from "./types.js";
