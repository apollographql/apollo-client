import { DocumentNode } from 'graphql';
import { FragmentMatcher } from 'graphql-anywhere';
import { FetchResult } from 'apollo-link-core';
import { Cache } from 'apollo-cache-core';

import { IdGetter } from '../core/types';

/**
 * This is a normalized representation of the Apollo query result cache. It consists of
 * a flattened representation of query result trees.
 */
export interface NormalizedCache {
  [dataId: string]: StoreObject;
}

export type OptimisticStoreItem = {
  id: string;
  data: NormalizedCache;
  transaction: (c: Cache) => void;
};

export type DiffResult = {
  result?: any;
  isMissing?: boolean;
};

export type ReadQueryOptions = {
  store: NormalizedCache;
  query: DocumentNode;
  fragmentMatcherFunction?: FragmentMatcher; // TODO make this required to prevent bugs
  variables?: Object;
  previousResult?: any;
  rootId?: string;
  config?: ApolloReducerConfig;
};

export type DiffQueryAgainstStoreOptions = ReadQueryOptions & {
  returnPartialData?: boolean;
};

export type CustomResolver = (
  rootValue: any,
  args: { [argName: string]: any },
) => any;

export type CustomResolverMap = {
  [typeName: string]: {
    [fieldName: string]: CustomResolver;
  };
};

export interface StoreObject {
  __typename?: string;
  [storeFieldKey: string]: StoreValue;
}

export type ApolloReducerConfig = {
  dataIdFromObject?: IdGetter;
  customResolvers?: CustomResolverMap;
  fragmentMatcher?: FragmentMatcher;
  addTypename?: boolean;
};

export type ReadStoreContext = {
  store: NormalizedCache;
  returnPartialData: boolean;
  hasMissingField: boolean;
  customResolvers: CustomResolverMap;
};

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

export interface IdValue {
  type: 'id';
  id: string;
  generated: boolean;
}

export interface JsonValue {
  type: 'json';
  json: any;
}

export type ListValue = Array<null | IdValue>;

export type StoreValue =
  | number
  | string
  | string[]
  | IdValue
  | ListValue
  | JsonValue
  | null
  | undefined
  | void
  | Object;

export interface FragmentMatcherInterface {
  match(
    idValue: IdValue,
    typeCondition: string,
    context: ReadStoreContext,
  ): boolean;
}

export type PossibleTypesMap = { [key: string]: string[] };

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

// This is part of the public API, people write these functions in `updateQueries`.
export type MutationQueryReducer<T> = (
  previousResult: Record<string, any>,
  options: {
    mutationResult: FetchResult<T>;
    queryName: string | undefined;
    queryVariables: Record<string, any>;
  },
) => Record<string, any>;

export type MutationQueryReducersMap<T = { [key: string]: any }> = {
  [queryName: string]: MutationQueryReducer<T>;
};
