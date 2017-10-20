import { DocumentNode } from 'graphql';
import { FragmentMatcher } from 'graphql-anywhere';
import {
  Transaction,
  NormalizedCacheObject,
  NormalizedCache,
} from 'apollo-cache';
import { IdValue } from 'apollo-utilities';

export type IdGetter = (value: Object) => string | null | undefined;

export type NormalizedCacheFactory = (
  seed?: NormalizedCacheObject,
) => NormalizedCache;

export type OptimisticStoreItem = {
  id: string;
  data: NormalizedCacheObject;
  transaction: Transaction<NormalizedCacheObject>;
};

export type ReadQueryOptions = {
  store: NormalizedCache;
  query: DocumentNode;
  fragmentMatcherFunction?: FragmentMatcher;
  variables?: Object;
  previousResult?: any;
  rootId?: string;
  config?: ApolloReducerConfig;
};

export type DiffQueryAgainstStoreOptions = ReadQueryOptions & {
  returnPartialData?: boolean;
};

export type ApolloReducerConfig = {
  dataIdFromObject?: IdGetter;
  fragmentMatcher?: FragmentMatcherInterface;
  addTypename?: boolean;
  cacheResolvers?: CacheResolverMap;
  storeFactory?: NormalizedCacheFactory;
};

export type ReadStoreContext = {
  store: NormalizedCache;
  returnPartialData: boolean;
  hasMissingField: boolean;
  cacheResolvers: CacheResolverMap;
};

export interface FragmentMatcherInterface {
  match(
    idValue: IdValue,
    typeCondition: string,
    context: ReadStoreContext,
  ): boolean;
}

export type PossibleTypesMap = { [key: string]: string[] };

/**
 * This code needs an optional `previousResult` property on `IdValue` so that when the results
 * returned from the store are the same, we can just return the `previousResult` and not a new
 * value thus preserving referential equality.
 *
 * The `previousResult` property is added to our `IdValue`s in the `graphql-anywhere` resolver so
 * that they can be in the right position for `resultMapper` to test equality and return whichever
 * result is appropriate.
 *
 * `resultMapper` takes the `previousResult`s and performs a shallow referential equality check. If
 * that passes then instead of returning the object created by `graphql-anywhere` the
 * `resultMapper` function will instead return the `previousResult`. This process is bottom-up so
 * we start at the leaf results and swap them for `previousResult`s all the way up until we get to
 * the root object.
 */
export interface IdValueWithPreviousResult extends IdValue {
  previousResult?: any;
}

export type IntrospectionResultData = {
  __schema: {
    types: [
      {
        kind: string;
        name: string;
        possibleTypes: {
          name: string;
        }[];
      }
    ];
  };
};

export type CacheResolver = (
  rootValue: any,
  args: { [argName: string]: any },
) => any;

export type CacheResolverMap = {
  [typeName: string]: {
    [fieldName: string]: CacheResolver;
  };
};

// backwards compat
export type CustomResolver = CacheResolver;
export type CustomResolverMap = CacheResolverMap;
export {
  NormalizedCacheObject,
  NormalizedCache,
  StoreObject,
} from 'apollo-cache';
