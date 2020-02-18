import { DocumentNode } from 'graphql';

import { Transaction } from '../core/cache';
import { Modifier, Modifiers } from '../core/types/common';
import { StoreValue, StoreObject } from '../../utilities/graphql/storeUtils';
import { FieldValueGetter } from './entityStore';
export { StoreValue }

export interface IdGetterObj extends Object {
  __typename?: string;
  id?: string;
  _id?: string;
}

export declare type IdGetter = (
  value: IdGetterObj,
) => string | null | undefined;

/**
 * This is an interface used to access, set and remove
 * StoreObjects from the cache
 */
export interface NormalizedCache {
  has(dataId: string): boolean;
  get(dataId: string, fieldName: string): StoreValue;
  merge(dataId: string, incoming: StoreObject): void;
  modify(dataId: string, modifiers: Modifier<any> | Modifiers): boolean;
  delete(dataId: string, fieldName?: string): boolean;
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

  /**
   * Retain (or release) a given root ID to protect (or expose) it and its
   * transitive child entities from (or to) garbage collection. The current
   * retainment count is returned by both methods. Note that releasing a root
   * ID does not cause that entity to be garbage collected, but merely removes
   * it from the set of root IDs that will be considered during the next
   * mark-and-sweep collection.
   */
  retain(rootId: string): number;
  release(rootId: string): number;

  getFieldValue: FieldValueGetter;
}

/**
 * This is a normalized representation of the Apollo query result cache. It consists of
 * a flattened representation of query result trees.
 */
export interface NormalizedCacheObject {
  [dataId: string]: StoreObject | undefined;
}

export type OptimisticStoreItem = {
  id: string;
  data: NormalizedCacheObject;
  transaction: Transaction<NormalizedCacheObject>;
};

export type ReadQueryOptions = {
  store: NormalizedCache;
  query: DocumentNode;
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
  addTypename?: boolean;
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
