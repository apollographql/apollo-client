export { Transaction, ApolloCache } from './core/cache';
export { Cache } from './core/types/Cache';
export { DataProxy } from './core/types/DataProxy';
export { MissingFieldError } from './core/types/common';

export {
  Reference,
  isReference,
  makeReference,
} from '../utilities';

export {
  InMemoryCache,
  InMemoryCacheConfig,
} from './inmemory/inMemoryCache';

export {
  ReactiveVar,
  makeVar,
  cacheSlot,
} from './inmemory/reactiveVars';

export {
  defaultDataIdFromObject,
  TypePolicies,
  TypePolicy,
  FieldPolicy,
  FieldReadFunction,
  FieldMergeFunction,
  FieldFunctionOptions,
  PossibleTypesMap,
} from './inmemory/policies';

export * from './inmemory/types';
