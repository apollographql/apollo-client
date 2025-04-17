export type {
  Transaction,
  WatchFragmentOptions,
  WatchFragmentResult,
} from "./core/cache.js";
export { ApolloCache } from "./core/cache.js";
export type { Cache } from "./core/types/Cache.js";
export type { DataProxy } from "./core/types/DataProxy.js";
export type {
  MissingTree,
  Modifier,
  ModifierDetails,
  Modifiers,
  ReadFieldOptions,
} from "./core/types/common.js";
export { MissingFieldError } from "./core/types/common.js";

export type { Reference } from "@apollo/client/utilities";
export {
  canonicalStringify,
  isReference,
  makeReference,
} from "@apollo/client/utilities";

export { EntityStore } from "./inmemory/entityStore.js";
export {
  defaultDataIdFromObject,
  fieldNameFromStoreName,
} from "./inmemory/helpers.js";

export { InMemoryCache } from "./inmemory/inMemoryCache.js";

export type { ReactiveVar } from "./inmemory/reactiveVars.js";
export { cacheSlot, makeVar } from "./inmemory/reactiveVars.js";

export type {
  FieldFunctionOptions,
  FieldMergeFunction,
  FieldPolicy,
  FieldReadFunction,
  PossibleTypesMap,
  TypePolicies,
  TypePolicy,
} from "./inmemory/policies.js";
export { Policies } from "./inmemory/policies.js";

export type { FragmentRegistryAPI } from "./inmemory/fragmentRegistry.js";
export { createFragmentRegistry } from "./inmemory/fragmentRegistry.js";

export type {
  ApolloReducerConfig,
  DiffQueryAgainstStoreOptions,
  IdGetter,
  IdGetterObj,
  InMemoryCacheConfig,
  MergeInfo,
  MergeTree,
  NormalizedCache,
  NormalizedCacheObject,
  OptimisticStoreItem,
  ReadMergeModifyContext,
  ReadQueryOptions,
  StoreObject,
  StoreValue,
} from "./inmemory/types.js";
