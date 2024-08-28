import "../utilities/globals/index.js";

export type {
  Transaction,
  WatchFragmentOptions,
  WatchFragmentResult,
} from "./core/cache.js";
export { ApolloCache } from "./core/cache.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-exports
export { Cache } from "./core/types/Cache.js";
export type { DataProxy } from "./core/types/DataProxy.js";
export type {
  MissingTree,
  Modifier,
  Modifiers,
  ModifierDetails,
  ReadFieldOptions,
} from "./core/types/common.js";
export { MissingFieldError } from "./core/types/common.js";

export type { Reference } from "../utilities/index.js";
export {
  isReference,
  makeReference,
  canonicalStringify,
} from "../utilities/index.js";

export { EntityStore } from "./inmemory/entityStore.js";
export {
  fieldNameFromStoreName,
  defaultDataIdFromObject,
} from "./inmemory/helpers.js";

export { InMemoryCache } from "./inmemory/inMemoryCache.js";

export type { ReactiveVar } from "./inmemory/reactiveVars.js";
export { makeVar, cacheSlot } from "./inmemory/reactiveVars.js";

export type {
  TypePolicies,
  TypePolicy,
  FieldPolicy,
  FieldReadFunction,
  FieldMergeFunction,
  FieldFunctionOptions,
  PossibleTypesMap,
} from "./inmemory/policies.js";
export { Policies } from "./inmemory/policies.js";

export type { FragmentRegistryAPI } from "./inmemory/fragmentRegistry.js";
export { createFragmentRegistry } from "./inmemory/fragmentRegistry.js";

export * from "./inmemory/types.js";
