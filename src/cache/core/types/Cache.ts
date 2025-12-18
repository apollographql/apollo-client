import type {
  DataValue,
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";
import type { Unmasked } from "@apollo/client/masking";

import type { ApolloCache } from "../cache.js";

import type {
  AllFieldsModifier,
  MissingFieldError,
  Modifiers,
} from "./common.js";
export declare namespace Cache {
  export type WatchCallback<TData = unknown> = (
    diff: Cache.DiffResult<TData>,
    lastDiff?: Cache.DiffResult<TData>
  ) => void;

  export interface ReadOptions<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > {
    /**
     * The GraphQL query shape to be used constructed using the `gql` template
     * string tag from `graphql-tag`. The query will be used to determine the
     * shape of the data to be read.
     */
    query: DocumentNode | TypedDocumentNode<TData, TVariables>;

    /**
     * Any variables that the GraphQL query may depend on.
     */
    variables?: TVariables;

    /**
     * The root id to be used. Defaults to "ROOT_QUERY", which is the ID of the
     * root query object. This property makes writeQuery capable of writing data
     * to any object in the cache.
     */
    id?: string;
    rootId?: string;
    previousResult?: any;
    optimistic: boolean;
    returnPartialData?: boolean;
  }

  export interface WriteOptions<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > {
    /**
     * The GraphQL query shape to be used constructed using the `gql` template
     * string tag from `graphql-tag`. The query will be used to determine the
     * shape of the data to be read.
     */
    query: DocumentNode | TypedDocumentNode<TData, TVariables>;

    /**
     * Any variables that the GraphQL query may depend on.
     */
    variables?: TVariables;

    dataId?: string;
    result: Unmasked<TData>;

    /**
     * Whether to notify query watchers.
     * @defaultValue true
     */
    broadcast?: boolean;
    /**
     * When true, ignore existing field data rather than merging it with
     * incoming data.
     * @defaultValue false
     */
    overwrite?: boolean;
  }

  export interface DiffOptions<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > extends Omit<ReadOptions<TData, TVariables>, "rootId"> {
    // The DiffOptions interface is currently just an alias for
    // ReadOptions, though DiffOptions used to be responsible for
    // declaring the returnPartialData option.
  }

  export interface WatchOptions<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > extends DiffOptions<TData, TVariables> {
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
    TCache extends ApolloCache,
    TUpdateResult = void,
  > {
    /**
     * A function that performs cache operations. Receives the cache instance as its argument.
     *
     * The return value of this function becomes the return value of `batch`.
     */
    update(cache: TCache): TUpdateResult;

    /**
     * Controls how optimistic data is handled:
     *
     * - `string`: Creates a new optimistic layer with this ID. Use `removeOptimistic` later to remove it.
     * - `true`: Updates the current top layer of the cache (including any optimistic data).
     * - `false`: Updates only the root (non-optimistic) cache data.
     *
     * @defaultValue false
     */
    optimistic?: string | boolean;

    /**
     * If provided, removes the optimistic layer with this ID after the batch completes.
     *
     * This is useful for atomically applying server data while removing a pending optimistic update, triggering at most one broadcast for both operations.
     *
     * Note: this option is needed because calling `cache.removeOptimistic` during the transaction function may not be safe, since any modifications to cache layers may be discarded after the transaction finishes.
     */
    removeOptimistic?: string;

    /**
     * Optional callback invoked for each watcher affected by the batch operation.
     *
     * Receives the watch options, the new diff result, and optionally the previous diff result.
     *
     * Return `false` to prevent broadcasting to that specific watcher.
     */
    onWatchUpdated?: (
      this: TCache,
      watch: Cache.WatchOptions,
      diff: Cache.DiffResult<any>,
      lastDiff?: Cache.DiffResult<any> | undefined
    ) => any;
  }

  export interface ReadQueryOptions<
    TData,
    TVariables extends OperationVariables,
  > {
    /**
     * The GraphQL query shape to be used constructed using the `gql` template
     * string tag. The query will be used to determine the
     * shape of the data to be read.
     */
    query: DocumentNode | TypedDocumentNode<TData, TVariables>;

    /**
     * Any variables that the GraphQL query may depend on.
     */
    variables?: TVariables;

    /**
     * The root id to be used. Defaults to "ROOT_QUERY", which is the ID of the
     * root query object. This property makes readQuery capable of reading data
     * from any object in the cache.
     */
    id?: string;
    /**
     * Whether to return incomplete data rather than null.
     * @defaultValue false
     */
    returnPartialData?: boolean;
    /**
     * Whether to read from optimistic or non-optimistic cache data. If
     * this named option is provided, the optimistic parameter of the
     * readQuery method can be omitted.
     * @defaultValue false
     */
    optimistic?: boolean;
  }

  export interface ReadFragmentOptions<
    TData,
    TVariables extends OperationVariables,
  > {
    /**
     * The root id to be used. This id should take the same form as the
     * value returned by the `cache.identify` function. If a value with your
     * id does not exist in the store, `null` will be returned.
     */
    id?: string;

    /**
     * A GraphQL document created using the `gql` template string tag from
     * `graphql-tag` with one or more fragments which will be used to determine
     * the shape of data to read. If you provide more than one fragment in this
     * document then you must also specify `fragmentName` to specify which
     * fragment is the root fragment.
     */
    fragment: DocumentNode | TypedDocumentNode<TData, TVariables>;

    /**
     * The name of the fragment in your GraphQL document to be used. If you do
     * not provide a `fragmentName` and there is only one fragment in your
     * `fragment` document then that fragment will be used.
     */
    fragmentName?: string;

    /**
     * Any variables that your GraphQL fragments depend on.
     */
    variables?: TVariables;

    /**
     * Whether to return incomplete data rather than null.
     * @defaultValue false
     */
    returnPartialData?: boolean;
    /**
     * Whether to read from optimistic or non-optimistic cache data. If
     * this named option is provided, the optimistic parameter of the
     * readFragment method can be omitted.
     * @defaultValue false
     */
    optimistic?: boolean;
  }

  export interface WriteQueryOptions<
    TData,
    TVariables extends OperationVariables,
  > {
    /**
     * The GraphQL query shape to be used constructed using the `gql` template
     * string tag from `graphql-tag`. The query will be used to determine the
     * shape of the data to be read.
     */
    query: DocumentNode | TypedDocumentNode<TData, TVariables>;

    /**
     * Any variables that the GraphQL query may depend on.
     */
    variables?: TVariables;

    /**
     * The root id to be used. Defaults to "ROOT_QUERY", which is the ID of the
     * root query object. This property makes writeQuery capable of writing data
     * to any object in the cache.
     */
    id?: string;

    /**
     * The data to write to the store.
     */
    data: Unmasked<TData>;
    /**
     * Whether to notify query watchers.
     * @defaultValue true
     */
    broadcast?: boolean;
    /**
     * When true, ignore existing field data rather than merging it with
     * incoming data.
     * @defaultValue false
     */
    overwrite?: boolean;
  }

  export interface WriteFragmentOptions<
    TData,
    TVariables extends OperationVariables,
  > {
    /**
     * The root id to be used. This id should take the same form as the
     * value returned by the `cache.identify` function. If a value with your
     * id does not exist in the store, `null` will be returned.
     */
    id?: string;

    /**
     * A GraphQL document created using the `gql` template string
     * with one or more fragments which will be used to determine
     * the shape of data to read. If you provide more than one fragment in this
     * document then you must also specify `fragmentName` to specify specify which
     * fragment is the root fragment.
     */
    fragment: DocumentNode | TypedDocumentNode<TData, TVariables>;

    /**
     * The name of the fragment in your GraphQL document to be used. If you do
     * not provide a `fragmentName` and there is only one fragment in your
     * `fragment` document then that fragment will be used.
     */
    fragmentName?: string;

    /**
     * Any variables that your GraphQL fragments depend on.
     */
    variables?: TVariables;
    /**
     * The data to write to the store.
     */
    data: Unmasked<TData>;
    /**
     * Whether to notify query watchers.
     * @defaultValue true
     */
    broadcast?: boolean;
    /**
     * When true, ignore existing field data rather than merging it with
     * incoming data.
     * @defaultValue false
     */
    overwrite?: boolean;
  }

  export interface UpdateQueryOptions<
    TData,
    TVariables extends OperationVariables,
  > extends Omit<
      ReadQueryOptions<TData, TVariables> &
        WriteQueryOptions<TData, TVariables>,
      "data"
    > {}

  export interface UpdateFragmentOptions<
    TData,
    TVariables extends OperationVariables,
  > extends Omit<
      ReadFragmentOptions<TData, TVariables> &
        WriteFragmentOptions<TData, TVariables>,
      "data"
    > {}

  export type DiffResult<TData> =
    | {
        result: DataValue.Complete<TData>;
        complete: true;
        missing?: never;
        fromOptimisticTransaction?: boolean;
      }
    | {
        result: DataValue.Partial<TData> | null;
        complete: false;
        missing?: MissingFieldError;
        fromOptimisticTransaction?: boolean;
      };
}
