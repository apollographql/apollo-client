import { DocumentNode } from 'graphql';
import { FragmentMatcher } from './readFromStore';
import { Transaction } from 'apollo-cache';
import { IdValue, StoreValue } from 'apollo-utilities';

export interface IdGetterObj extends Object {
  __typename?: string;
  id?: string;
}
export declare type IdGetter = (
  value: IdGetterObj,
) => string | null | undefined;

/**
 * This is an interface used to access, set and remove
 * StoreObjects from the cache
 */
export interface NormalizedCache {
  get(dataId: string): StoreObject;
  set(dataId: string, value: StoreObject): void;
  delete(dataId: string): void;
  clear(): void;

  // non-Map elements:
  /**
   * returns an Object with key-value pairs matching the contents of the store
   */
  toObject(): NormalizedCacheObject;
  /**
   * replace the state of the store
   */
  replace(newData: NormalizedCacheObject): void;
}

/**
 * This is a normalized representation of the Apollo query result cache. It consists of
 * a flattened representation of query result trees.
 */
export interface NormalizedCacheObject {
  [dataId: string]: StoreObject;
}

export interface StoreObject {
  __typename?: string;
  [storeFieldKey: string]: StoreValue;
}

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
  cacheRedirects?: CacheResolverMap;
};

export type ReadStoreContext = {
  readonly store: NormalizedCache;
  readonly cacheRedirects: CacheResolverMap;
  readonly dataIdFromObject?: IdGetter;
};

export interface FragmentMatcherInterface {
  match(
    idValue: IdValue,
    typeCondition: string,
    context: ReadStoreContext,
  ): boolean | 'heuristic';
}

export type PossibleTypesMap = { [key: string]: string[] };

export type IntrospectionResultData = {
  __schema: {
    types: {
      kind: string;
      name: string;
      possibleTypes: {
        name: string;
      }[];
    }[];
  };
};

export type CacheResolver = (
  rootValue: any,
  args: { [argName: string]: any },
  context: any,
) => any;

export type CacheResolverMap = {
  [typeName: string]: {
    [fieldName: string]: CacheResolver;
  };
};

// backwards compat
export type CustomResolver = CacheResolver;
export type CustomResolverMap = CacheResolverMap;
