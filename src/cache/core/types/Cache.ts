import type { DataProxy } from "./DataProxy.js";
import type { AllFieldsModifier, Modifiers } from "./common.js";
import type { ApolloCache } from "../cache.js";

export namespace Cache {
  // @ts-ignore
  const _ = ""; // Make typescript export something
  export type WatchCallback<TData = any> = (
    diff: Cache.DiffResult<TData>,
    lastDiff?: Cache.DiffResult<TData>
  ) => void;

  export type ReadOptions<TVariables = any, TData = any> = DataProxy.Query<
    TVariables,
    TData
  > & {
    rootId?: string;
    previousResult?: any;
    optimistic: boolean;
    returnPartialData?: boolean;
    /**
     * @deprecated
     * Using `canonizeResults` can result in memory leaks so we generally do not
     * recommend using this option anymore.
     * A future version of Apollo Client will contain a similar feature without
     * the risk of memory leaks.
     */
    canonizeResults?: boolean;
  };

  export interface WriteOptions<TResult = any, TVariables = any>
    extends Omit<DataProxy.Query<TVariables, TResult>, "id">,
      Omit<DataProxy.WriteOptions<TResult>, "data"> {
    dataId?: string;
    result: TResult;
  }

  export interface DiffOptions<TData = any, TVariables = any>
    extends Omit<ReadOptions<TVariables, TData>, "rootId"> {
    // The DiffOptions interface is currently just an alias for
    // ReadOptions, though DiffOptions used to be responsible for
    // declaring the returnPartialData option.
  }

  export interface WatchOptions<TData = any, TVariables = any>
    extends DiffOptions<TData, TVariables> {
    watcher?: object;
    immediate?: boolean;
    callback: WatchCallback<TData>;
    lastDiff?: DiffResult<TData>;
  }

  export interface EvictOptions {
    id?: string;
    fieldName?: string;
    args?: Record<string, any>;
    broadcast?: boolean;
  }

  // Although you can call cache.reset() without options, its behavior can be
  // configured by passing a Cache.ResetOptions object.
  export interface ResetOptions {
    discardWatches?: boolean;
  }

  export interface ModifyOptions<
    Entity extends Record<string, any> = Record<string, any>,
  > {
    id?: string;
    fields: Modifiers<Entity> | AllFieldsModifier<Entity>;
    optimistic?: boolean;
    broadcast?: boolean;
  }

  export interface BatchOptions<
    TCache extends ApolloCache<any>,
    TUpdateResult = void,
  > {
    // Same as the first parameter of performTransaction, except the cache
    // argument will have the subclass type rather than ApolloCache.
    update(cache: TCache): TUpdateResult;

    // Passing a string for this option creates a new optimistic layer, with the
    // given string as its layer.id, just like passing a string for the
    // optimisticId parameter of performTransaction. Passing true is the same as
    // passing undefined to performTransaction (running the batch operation
    // against the current top layer of the cache), and passing false is the
    // same as passing null (running the operation against root/non-optimistic
    // cache data).
    optimistic?: string | boolean;

    // If you specify the ID of an optimistic layer using this option, that
    // layer will be removed as part of the batch transaction, triggering at
    // most one broadcast for both the transaction and the removal of the layer.
    // Note: this option is needed because calling cache.removeOptimistic during
    // the transaction function may not be not safe, since any modifications to
    // cache layers may be discarded after the transaction finishes.
    removeOptimistic?: string;

    // If you want to find out which watched queries were invalidated during
    // this batch operation, pass this optional callback function. Returning
    // false from the callback will prevent broadcasting this result.
    onWatchUpdated?: (
      this: TCache,
      watch: Cache.WatchOptions,
      diff: Cache.DiffResult<any>,
      lastDiff?: Cache.DiffResult<any> | undefined
    ) => any;
  }

  export type DiffResult<T> = DataProxy.DiffResult<T>;
  export type ReadQueryOptions<TData, TVariables> = DataProxy.ReadQueryOptions<
    TData,
    TVariables
  >;
  export type ReadFragmentOptions<TData, TVariables> =
    DataProxy.ReadFragmentOptions<TData, TVariables>;
  export type WriteQueryOptions<TData, TVariables> =
    DataProxy.WriteQueryOptions<TData, TVariables>;
  export type WriteFragmentOptions<TData, TVariables> =
    DataProxy.WriteFragmentOptions<TData, TVariables>;
  export type UpdateQueryOptions<TData, TVariables> =
    DataProxy.UpdateQueryOptions<TData, TVariables>;
  export type UpdateFragmentOptions<TData, TVariables> =
    DataProxy.UpdateFragmentOptions<TData, TVariables>;
  export type Fragment<TVariables, TData> = DataProxy.Fragment<
    TVariables,
    TData
  >;
}
