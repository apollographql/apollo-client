export { ApolloCache } from './core/cache';
export type { Transaction } from './core/cache';
export type { Cache } from './core/types/Cache';
export type { DataProxy } from './core/types/DataProxy';
export { MissingFieldError } from './core/types/common';

export {
  isReference,
  makeReference,
} from '../utilities/graphql/storeUtils';
export type { Reference } from '../utilities/graphql/storeUtils';

export { InMemoryCache } from './inmemory/inMemoryCache';
export type {
  InMemoryCacheConfig,
  ReactiveVar,
} from './inmemory/inMemoryCache';

export { defaultDataIdFromObject } from './inmemory/policies';
export type {
  TypePolicies,
  TypePolicy,
  FieldPolicy,
  FieldReadFunction,
  FieldMergeFunction,
  FieldFunctionOptions,
  PossibleTypesMap,
} from './inmemory/policies';

export * from './inmemory/types';
