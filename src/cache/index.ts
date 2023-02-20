import '../utilities/globals';

export { Transaction, ApolloCache } from './core/cache';
export { Cache } from './core/types/Cache';
export { DataProxy } from './core/types/DataProxy';
export {
  MissingTree,
  Modifier,
  Modifiers,
  ModifierDetails,
  MissingFieldError,
  ReadFieldOptions
} from './core/types/common';

export {
  Reference,
  isReference,
  makeReference,
} from '../utilities';

export { EntityStore } from './inmemory/entityStore';
export {
  fieldNameFromStoreName,
  defaultDataIdFromObject,
} from './inmemory/helpers'

export {
  InMemoryCache,
} from './inmemory/inMemoryCache';

export {
  ReactiveVar,
  makeVar,
  cacheSlot,
} from './inmemory/reactiveVars';

export {
  TypePolicies,
  TypePolicy,
  FieldPolicy,
  FieldReadFunction,
  FieldMergeFunction,
  FieldFunctionOptions,
  PossibleTypesMap,
  Policies,
} from './inmemory/policies';

export {
  canonicalStringify,
} from './inmemory/object-canon';

export {
  FragmentRegistryAPI,
  createFragmentRegistry,
} from './inmemory/fragmentRegistry';

export * from './inmemory/types';
