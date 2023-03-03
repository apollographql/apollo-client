import '../utilities/globals/index.js';

export { Transaction, ApolloCache } from './core/cache.js';
export { Cache } from './core/types/Cache.js';
export { DataProxy } from './core/types/DataProxy.js';
export {
  MissingTree,
  Modifier,
  Modifiers,
  ModifierDetails,
  MissingFieldError,
  ReadFieldOptions
} from './core/types/common.js';

export {
  Reference,
  isReference,
  makeReference,
} from '../utilities/index.js';

export { EntityStore } from './inmemory/entityStore.js';
export {
  fieldNameFromStoreName,
  defaultDataIdFromObject,
} from './inmemory/helpers.js';

export {
  InMemoryCache,
} from './inmemory/inMemoryCache.js';

export {
  ReactiveVar,
  makeVar,
  cacheSlot,
} from './inmemory/reactiveVars.js';

export {
  TypePolicies,
  TypePolicy,
  FieldPolicy,
  FieldReadFunction,
  FieldMergeFunction,
  FieldFunctionOptions,
  PossibleTypesMap,
  Policies,
} from './inmemory/policies.js';

export {
  canonicalStringify,
} from './inmemory/object-canon.js';

export {
  FragmentRegistryAPI,
  createFragmentRegistry,
} from './inmemory/fragmentRegistry.js';

export * from './inmemory/types.js';
