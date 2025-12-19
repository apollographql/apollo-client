import type { DocumentNode } from "graphql";
import { OperationTypeNode } from "graphql";
import type { Observable } from "rxjs";
import { map } from "rxjs";

import type {
  ApolloCache,
  IgnoreModifier,
  Reference,
} from "@apollo/client/cache";
import type { Incremental } from "@apollo/client/incremental";
import { NotImplementedHandler } from "@apollo/client/incremental";
import type { ApolloLink } from "@apollo/client/link";
import { execute } from "@apollo/client/link";
import type { ClientAwarenessLink } from "@apollo/client/link/client-awareness";
import type { LocalState } from "@apollo/client/local-state";
import type { MaybeMasked, Unmasked } from "@apollo/client/masking";
import { DocumentTransform } from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import type {
  VariablesOption,
  variablesUnknownSymbol,
} from "@apollo/client/utilities/internal";
import {
  checkDocument,
  compact,
  getApolloClientMemoryInternals,
  mergeOptions,
  removeMaskedFragmentSpreads,
} from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

import { version } from "../version.js";

import type { ObservableQuery } from "./ObservableQuery.js";
import { QueryManager } from "./QueryManager.js";
import type {
  DefaultContext,
  ErrorLike,
  InternalRefetchQueriesInclude,
  InternalRefetchQueriesResult,
  MutationQueryReducersMap,
  MutationUpdaterFunction,
  NormalizedExecutionResult,
  OnQueryUpdated,
  OperationVariables,
  RefetchQueriesInclude,
  RefetchQueriesPromiseResults,
  SubscriptionObservable,
  TypedDocumentNode,
} from "./types.js";
import type {
  ErrorPolicy,
  FetchPolicy,
  MutationFetchPolicy,
  NextFetchPolicyContext,
  RefetchWritePolicy,
  WatchQueryFetchPolicy,
} from "./watchQueryOptions.js";

let hasSuggestedDevtools = false;

export declare namespace ApolloClient {
  export interface DefaultOptions {
    watchQuery?: Partial<ApolloClient.WatchQueryOptions<any, any>>;
    query?: Partial<ApolloClient.QueryOptions<any, any>>;
    mutate?: Partial<ApolloClient.MutateOptions<any, any, any>>;
  }

  export interface Options {
    /**
     * An `ApolloLink` instance to serve as Apollo Client's network layer. For more information, see [Advanced HTTP networking](https://www.apollographql.com/docs/react/networking/advanced-http-networking/).
     */
    link: ApolloLink;
    /**
     * The cache that Apollo Client should use to store query results locally. The recommended cache is `InMemoryCache`, which is provided by the `@apollo/client` package.
     *
     * For more information, see [Configuring the cache](https://www.apollographql.com/docs/react/caching/cache-configuration/).
     */
    cache: ApolloCache;
    /**
     * The time interval (in milliseconds) before Apollo Client force-fetches queries after a server-side render.
     *
     * @defaultValue `0` (no delay)
     */
    ssrForceFetchDelay?: number;
    /**
     * When using Apollo Client for [server-side rendering](https://www.apollographql.com/docs/react/performance/server-side-rendering/), set this to `true` so that the [`getDataFromTree` function](../react/ssr/#getdatafromtree) can work effectively.
     *
     * @defaultValue `false`
     */
    ssrMode?: boolean;
    /**
     * If `false`, Apollo Client sends every created query to the server, even if a _completely_ identical query (identical in terms of query string, variable values, and operationName) is already in flight.
     *
     * @defaultValue `true`
     */
    queryDeduplication?: boolean;
    /**
     * Provide this object to set application-wide default values for options you can provide to the `watchQuery`, `query`, and `mutate` functions. See below for an example object.
     *
     * See this [example object](https://www.apollographql.com/docs/react/api/core/ApolloClient#example-defaultoptions-object).
     */
    defaultOptions?: ApolloClient.DefaultOptions;
    defaultContext?: Partial<DefaultContext>;
    /**
     * If `true`, Apollo Client will assume results read from the cache are never mutated by application code, which enables substantial performance optimizations.
     *
     * @defaultValue `false`
     */
    assumeImmutableResults?: boolean;
    localState?: LocalState;
    /** {@inheritDoc @apollo/client/link/client-awareness!ClientAwarenessLink.ClientAwarenessOptions:interface} */
    clientAwareness?: ClientAwarenessLink.ClientAwarenessOptions;
    /** {@inheritDoc @apollo/client/link/client-awareness!ClientAwarenessLink.EnhancedClientAwarenessOptions:interface} */
    enhancedClientAwareness?: ClientAwarenessLink.EnhancedClientAwarenessOptions;
    documentTransform?: DocumentTransform;

    /**
     * Configuration used by the [Apollo Client Devtools extension](https://www.apollographql.com/docs/react/development-testing/developer-tooling/#apollo-client-devtools) for this client.
     *
     * @since 3.11.0
     */
    devtools?: ApolloClient.DevtoolsOptions;

    /**
     * Determines if data masking is enabled for the client.
     *
     * @defaultValue false
     */
    dataMasking?: boolean;

    /**
     * Determines the strategy used to parse incremental chunks from `@defer`
     * queries.
     */
    incrementalHandler?: Incremental.Handler<any>;
  }

  interface DevtoolsOptions {
    /**
     * If `true`, the [Apollo Client Devtools](https://www.apollographql.com/docs/react/development-testing/developer-tooling/#apollo-client-devtools) browser extension can connect to this `ApolloClient` instance.
     *
     * The default value is `false` in production and `true` in development if there is a `window` object.
     */
    enabled?: boolean;

    /**
     * Optional name for this `ApolloClient` instance in the devtools. This is
     * useful when you instantiate multiple clients and want to be able to
     * identify them by name.
     */
    name?: string;
  }

  export type MutateOptions<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
    TCache extends ApolloCache = ApolloCache,
  > = {
    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#optimisticResponse:member} */
    optimisticResponse?:
      | Unmasked<NoInfer<TData>>
      | ((
          vars: TVariables,
          { IGNORE }: { IGNORE: IgnoreModifier }
        ) => Unmasked<NoInfer<TData>> | IgnoreModifier);

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#updateQueries:member} */
    updateQueries?: MutationQueryReducersMap<TData>;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#refetchQueries:member} */
    refetchQueries?:
      | ((
          result: NormalizedExecutionResult<Unmasked<TData>>
        ) => InternalRefetchQueriesInclude)
      | InternalRefetchQueriesInclude;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#awaitRefetchQueries:member} */
    awaitRefetchQueries?: boolean;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#update:member} */
    update?: MutationUpdaterFunction<TData, TVariables, TCache>;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#onQueryUpdated:member} */
    onQueryUpdated?: OnQueryUpdated<any>;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#errorPolicy:member} */
    errorPolicy?: ErrorPolicy;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#context:member} */
    context?: DefaultContext;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#fetchPolicy:member} */
    fetchPolicy?: MutationFetchPolicy;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#keepRootFields:member} */
    keepRootFields?: boolean;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#mutation:member} */
    mutation: DocumentNode | TypedDocumentNode<TData, TVariables>;
  } & VariablesOption<NoInfer<TVariables>>;

  export interface MutateResult<TData = unknown> {
    /** {@inheritDoc @apollo/client!MutationResultDocumentation#data:member} */
    data: TData | undefined;

    /** {@inheritDoc @apollo/client!MutationResultDocumentation#error:member} */
    error?: ErrorLike;

    /** {@inheritDoc @apollo/client!MutationResultDocumentation#extensions:member} */
    extensions?: Record<string, unknown>;
  }

  /**
   * Query options.
   */
  export type QueryOptions<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > = {
    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#query:member} */
    query: DocumentNode | TypedDocumentNode<TData, TVariables>;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#errorPolicy:member} */
    errorPolicy?: ErrorPolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
    context?: DefaultContext;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#fetchPolicy:member} */
    fetchPolicy?: FetchPolicy;
  } & VariablesOption<NoInfer<TVariables>>;

  export interface QueryResult<TData = unknown> {
    /** {@inheritDoc @apollo/client!QueryResultDocumentation#data:member} */
    data: TData | undefined;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#error:member} */
    error?: ErrorLike;
  }

  /**
   * Options object for the `client.refetchQueries` method.
   */
  export interface RefetchQueriesOptions<TCache extends ApolloCache, TResult> {
    /**
     * Optional function that updates cached fields to trigger refetches of queries that include those fields.
     */
    updateCache?: (cache: TCache) => void;

    /**
     * Optional array specifying queries to refetch. Each element can be either a query's string name or a `DocumentNode` object.
     *
     * Pass `"active"` as a shorthand to refetch all active queries, or `"all"` to refetch all active and inactive queries.
     *
     * Analogous to the [`options.refetchQueries`](https://www.apollographql.com/docs/react/data/mutations/#options) array for mutations.
     */
    include?: RefetchQueriesInclude;

    /**
     * If `true`, the `options.updateCache` function is executed on a temporary optimistic layer of `InMemoryCache`, so its modifications can be discarded from the cache after observing which fields it invalidated.
     *
     * Defaults to `false`, meaning `options.updateCache` updates the cache in a lasting way.
     */
    optimistic?: boolean;

    /**
     * Optional callback function that's called once for each `ObservableQuery` that's either affected by `options.updateCache` or listed in `options.include` (or both).
     *
     * If `onQueryUpdated` is not provided, the default implementation returns the result of calling `observableQuery.refetch()`. When `onQueryUpdated` is provided, it can dynamically decide whether (and how) each query should be refetched.
     *
     * Returning `false` from `onQueryUpdated` prevents the associated query from being refetched.
     */
    onQueryUpdated?: OnQueryUpdated<TResult> | null;
  }

  /**
   * The result of client.refetchQueries is thenable/awaitable, if you just want
   * an array of fully resolved results, but you can also access the raw results
   * immediately by examining the additional `queries` and `results` properties of
   * the `RefetchQueriesResult<TResult> object`.
   */
  export interface RefetchQueriesResult<TResult>
    extends Promise<RefetchQueriesPromiseResults<TResult>>,
      RefetchQueriesResult.AdditionalProperties<TResult> {}

  export namespace RefetchQueriesResult {
    export interface AdditionalProperties<TResult> {
      /**
       * An array of ObservableQuery objects corresponding 1:1 to TResult values
       * in the results arrays (both the `result` property and the resolved value).
       */
      queries: ObservableQuery<any>[];
      /**
       * An array of results that were either returned by `onQueryUpdated`, or provided by default in the absence of `onQueryUpdated`, including pending promises.
       *
       * If `onQueryUpdated` returns `false` for a given query, no result is provided for that query.
       *
       * If `onQueryUpdated` returns `true`, the resulting `Promise<ApolloQueryResult<any>>` is included in the `results` array instead of `true`.
       */
      results: InternalRefetchQueriesResult<TResult>[];
    }
  }

  export type SubscribeOptions<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > = {
    /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#query:member} */
    query: DocumentNode | TypedDocumentNode<TData, TVariables>;

    /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#fetchPolicy:member} */
    fetchPolicy?: FetchPolicy;

    /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#errorPolicy:member} */
    errorPolicy?: ErrorPolicy;

    /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#context:member} */
    context?: DefaultContext;

    /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#extensions:member} */
    extensions?: Record<string, any>;
  } & VariablesOption<NoInfer<TVariables>>;

  export interface SubscribeResult<TData = unknown> {
    /** {@inheritDoc @apollo/client!MutationResultDocumentation#data:member} */
    data: TData | undefined;

    /** {@inheritDoc @apollo/client!MutationResultDocumentation#error:member} */
    error?: ErrorLike;

    /** {@inheritDoc @apollo/client!MutationResultDocumentation#extensions:member} */
    extensions?: Record<string, unknown>;
  }

  export type WatchFragmentOptions<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > = ApolloCache.WatchFragmentOptions<TData, TVariables>;

  export type WatchFragmentResult<TData = unknown> =
    ApolloCache.WatchFragmentResult<TData>;

  /**
   * Watched query options.
   */
  export type WatchQueryOptions<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > = {
    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#fetchPolicy:member} */
    fetchPolicy?: WatchQueryFetchPolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#nextFetchPolicy:member} */
    nextFetchPolicy?:
      | WatchQueryFetchPolicy
      | ((
          this: WatchQueryOptions<TData, TVariables>,
          currentFetchPolicy: WatchQueryFetchPolicy,
          context: NextFetchPolicyContext<TData, TVariables>
        ) => WatchQueryFetchPolicy);

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#initialFetchPolicy:member} */
    initialFetchPolicy?: WatchQueryFetchPolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#refetchWritePolicy:member} */
    refetchWritePolicy?: RefetchWritePolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#errorPolicy:member} */
    errorPolicy?: ErrorPolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
    context?: DefaultContext;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#pollInterval:member} */
    pollInterval?: number;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#notifyOnNetworkStatusChange:member} */
    notifyOnNetworkStatusChange?: boolean;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#returnPartialData:member} */
    returnPartialData?: boolean;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#skipPollAttempt:member} */
    skipPollAttempt?: () => boolean;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#query:member} */
    query: DocumentNode | TypedDocumentNode<TData, TVariables>;

    /**
     * @internal This API is meant for framework integrations only.
     * Do not use for everyday use.
     *
     * Indicates that the variables are unknown at the time of query creation.
     * This option can only be set when `fetchPolicy` is `'standby'`.
     * Setting this to `true` will prevent `client.refetchQueries` from refetching
     * this query before it has left the `'standby'` state, either by setting a
     * `fetchPolicy`, or by calling `observableQuery.refetch()` explicitly.
     *
     * Changing this option after the query has been created will have no effect.
     */
    [variablesUnknownSymbol]?: boolean;
  } & VariablesOption<NoInfer<TVariables>>;

  namespace Base {
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
       * The root id to be used. Defaults to "ROOT_QUERY", which is the ID of the
       * root query object. This property makes `readQuery` capable of reading data
       * from any object in the cache.
       */
      id?: string;

      /**
       * Whether to return incomplete data rather than null.
       * @defaultValue false
       */
      returnPartialData?: boolean;

      /**
       * Whether to read from optimistic or non-optimistic cache data.
       * This option should be preferred over the `optimistic` parameter of the
       * `readQuery` method.
       * @defaultValue false
       */
      optimistic?: boolean;
    }
  }
  export type ReadQueryOptions<
    TData,
    TVariables extends OperationVariables,
  > = Base.ReadQueryOptions<TData, TVariables> & VariablesOption<TVariables>;

  export namespace DocumentationTypes {
    export interface ReadQueryOptions<
      TData,
      TVariables extends OperationVariables,
    > extends Base.ReadQueryOptions<TData, TVariables> {
      /**
       * Any variables that the GraphQL query may depend on.
       */
      variables?: TVariables;
    }
  }

  namespace Base {
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
       * A GraphQL document created using the `gql` template string tag
       * with one or more fragments which will be used to determine
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
       * Whether to return incomplete data rather than null.
       * @defaultValue false
       */
      returnPartialData?: boolean;
      /**
       * Whether to read from optimistic or non-optimistic cache data.
       * This option should be preferred over the `optimistic` parameter of the
       * `readFragment` method.
       * @defaultValue false
       */
      optimistic?: boolean;
    }
  }
  export type ReadFragmentOptions<
    TData,
    TVariables extends OperationVariables,
  > = Base.ReadFragmentOptions<TData, TVariables> & VariablesOption<TVariables>;

  export namespace DocumentationTypes {
    export interface WriteQueryOptions<
      TData,
      TVariables extends OperationVariables,
    > extends Base.WriteQueryOptions<TData, TVariables> {
      /**
       * Any variables that your GraphQL fragments depend on.
       */
      variables?: TVariables;
    }
  }

  namespace Base {
    export interface WriteQueryOptions<
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
  }
  export type WriteQueryOptions<
    TData,
    TVariables extends OperationVariables,
  > = Base.WriteQueryOptions<TData, TVariables> & VariablesOption<TVariables>;

  export namespace DocumentationTypes {
    export interface WriteQueryOptions<
      TData,
      TVariables extends OperationVariables,
    > extends Base.WriteQueryOptions<TData, TVariables> {
      /**
       * Any variables that the GraphQL query may depend on.
       */
      variables?: TVariables;
    }
  }

  namespace Base {
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
  }
  export type WriteFragmentOptions<
    TData,
    TVariables extends OperationVariables,
  > = Base.WriteFragmentOptions<TData, TVariables> &
    VariablesOption<TVariables>;

  export namespace DocumentationTypes {
    export interface WriteFragmentOptions<
      TData,
      TVariables extends OperationVariables,
    > extends Base.WriteFragmentOptions<TData, TVariables> {
      /**
       * Any variables that your GraphQL fragments depend on.
       */
      variables?: TVariables;
    }
  }
}

/**
 * This is the primary Apollo Client class. It is used to send GraphQL documents (i.e. queries
 * and mutations) to a GraphQL spec-compliant server over an `ApolloLink` instance,
 * receive results from the server and cache the results in a store. It also delivers updates
 * to GraphQL queries through `Observable` instances.
 */
export class ApolloClient {
  public link: ApolloLink;
  public cache: ApolloCache;
  /**
   * @deprecated `disableNetworkFetches` has been renamed to `prioritizeCacheValues`.
   */
  public disableNetworkFetches!: never;

  public set prioritizeCacheValues(value: boolean) {
    this.queryManager.prioritizeCacheValues = value;
  }

  /**
   * Whether to prioritize cache values over network results when `query` or `watchQuery` is called.
   * This will essentially turn a `"network-only"` or `"cache-and-network"` fetchPolicy into a `"cache-first"` fetchPolicy,
   * but without influencing the `fetchPolicy` of the created `ObservableQuery` long-term.
   *
   * This can e.g. be used to prioritize the cache during the first render after SSR.
   */
  public get prioritizeCacheValues() {
    return this.queryManager.prioritizeCacheValues;
  }
  public version: string;
  public queryDeduplication: boolean;
  public defaultOptions: ApolloClient.DefaultOptions;
  public readonly devtoolsConfig: ApolloClient.DevtoolsOptions;

  private queryManager: QueryManager;
  private devToolsHookCb?: Function;
  private resetStoreCallbacks: Array<() => Promise<any>> = [];
  private clearStoreCallbacks: Array<() => Promise<any>> = [];

  /**
   * Constructs an instance of `ApolloClient`.
   *
   * @example
   *
   * ```js
   * import { ApolloClient, InMemoryCache } from "@apollo/client";
   *
   * const cache = new InMemoryCache();
   *
   * const client = new ApolloClient({
   *   // Provide required constructor fields
   *   cache: cache,
   *   uri: "http://localhost:4000/",
   *
   *   // Provide some optional constructor fields
   *   name: "react-web-client",
   *   version: "1.3",
   *   queryDeduplication: false,
   *   defaultOptions: {
   *     watchQuery: {
   *       fetchPolicy: "cache-and-network",
   *     },
   *   },
   * });
   * ```
   */
  constructor(options: ApolloClient.Options) {
    if (__DEV__) {
      invariant(
        options.cache,
        "To initialize Apollo Client, you must specify a 'cache' property " +
          "in the options object. \n" +
          "For more information, please visit: https://go.apollo.dev/c/docs"
      );

      invariant(
        options.link,
        "To initialize Apollo Client, you must specify a 'link' property " +
          "in the options object. \n" +
          "For more information, please visit: https://go.apollo.dev/c/docs"
      );
    }

    const {
      cache,
      documentTransform,
      ssrMode = false,
      ssrForceFetchDelay = 0,
      queryDeduplication = true,
      defaultOptions,
      defaultContext,
      assumeImmutableResults = cache.assumeImmutableResults,
      localState,
      devtools,
      dataMasking,
      link,
      incrementalHandler = new NotImplementedHandler(),
    } = options;

    this.link = link;
    this.cache = cache;
    this.queryDeduplication = queryDeduplication;
    this.defaultOptions = defaultOptions || {};
    this.devtoolsConfig = {
      ...devtools,
      enabled: devtools?.enabled ?? __DEV__,
    };

    this.watchQuery = this.watchQuery.bind(this);
    this.query = this.query.bind(this);
    this.mutate = this.mutate.bind(this);
    this.watchFragment = this.watchFragment.bind(this);
    this.resetStore = this.resetStore.bind(this);
    this.reFetchObservableQueries = this.refetchObservableQueries =
      this.refetchObservableQueries.bind(this);

    this.version = version;

    this.queryManager = new QueryManager({
      client: this,
      defaultOptions: this.defaultOptions,
      defaultContext,
      documentTransform,
      queryDeduplication,
      ssrMode,
      dataMasking: !!dataMasking,
      clientOptions: options,
      incrementalHandler,
      assumeImmutableResults,
      onBroadcast:
        this.devtoolsConfig.enabled ?
          () => {
            if (this.devToolsHookCb) {
              this.devToolsHookCb();
            }
          }
        : void 0,
      localState,
    });

    this.prioritizeCacheValues = ssrMode || ssrForceFetchDelay > 0;
    if (ssrForceFetchDelay) {
      setTimeout(() => {
        this.prioritizeCacheValues = false;
      }, ssrForceFetchDelay);
    }

    if (this.devtoolsConfig.enabled) this.connectToDevTools();
  }

  private connectToDevTools() {
    if (typeof window === "undefined") {
      return;
    }

    type DevToolsConnector = {
      push(client: ApolloClient): void;
    };
    const windowWithDevTools = window as Window & {
      [devtoolsSymbol]?: DevToolsConnector;
      __APOLLO_CLIENT__?: ApolloClient;
    };
    const devtoolsSymbol = Symbol.for("apollo.devtools");
    (windowWithDevTools[devtoolsSymbol] =
      windowWithDevTools[devtoolsSymbol] || ([] as DevToolsConnector)).push(
      this
    );
    windowWithDevTools.__APOLLO_CLIENT__ = this;

    /**
     * Suggest installing the devtools for developers who don't have them
     */
    if (!hasSuggestedDevtools && __DEV__) {
      hasSuggestedDevtools = true;
      if (
        window.document &&
        window.top === window.self &&
        /^(https?|file):$/.test(window.location.protocol)
      ) {
        setTimeout(() => {
          if (!(window as any).__APOLLO_DEVTOOLS_GLOBAL_HOOK__) {
            const nav = window.navigator;
            const ua = nav && nav.userAgent;
            let url: string | undefined;
            if (typeof ua === "string") {
              if (ua.indexOf("Chrome/") > -1) {
                url =
                  "https://chrome.google.com/webstore/detail/" +
                  "apollo-client-developer-t/jdkknkkbebbapilgoeccciglkfbmbnfm";
              } else if (ua.indexOf("Firefox/") > -1) {
                url =
                  "https://addons.mozilla.org/en-US/firefox/addon/apollo-developer-tools/";
              }
            }
            if (url) {
              invariant.log(
                "Download the Apollo DevTools for a better development " +
                  "experience: %s",
                url
              );
            }
          }
        }, 10000);
      }
    }
  }

  /**
   * The `DocumentTransform` used to modify GraphQL documents before a request
   * is made. If a custom `DocumentTransform` is not provided, this will be the
   * default document transform.
   */
  get documentTransform() {
    return this.queryManager.documentTransform;
  }

  /**
   * The configured `LocalState` instance used to enable the use of `@client`
   * fields.
   */
  get localState(): LocalState | undefined {
    return this.queryManager.localState;
  }

  set localState(localState: LocalState) {
    this.queryManager.localState = localState;
  }

  /**
   * Call this method to terminate any active client processes, making it safe
   * to dispose of this `ApolloClient` instance.
   *
   * This method performs aggressive cleanup to prevent memory leaks:
   *
   * - Unsubscribes all active `ObservableQuery` instances by emitting a `completed` event
   * - Rejects all currently running queries with "QueryManager stopped while query was in flight"
   * - Removes all queryRefs from the suspense cache
   */
  public stop() {
    this.queryManager.stop();
  }

  /**
   * This watches the cache store of the query according to the options specified and
   * returns an `ObservableQuery`. We can subscribe to this `ObservableQuery` and
   * receive updated results through an observer when the cache store changes.
   *
   * Note that this method is not an implementation of GraphQL subscriptions. Rather,
   * it uses Apollo's store in order to reactively deliver updates to your query results.
   *
   * For example, suppose you call watchQuery on a GraphQL query that fetches a person's
   * first and last name and this person has a particular object identifier, provided by
   * `cache.identify`. Later, a different query fetches that same person's
   * first and last name and the first name has now changed. Then, any observers associated
   * with the results of the first query will be updated with a new result object.
   *
   * Note that if the cache does not change, the subscriber will _not_ be notified.
   *
   * See [here](https://medium.com/apollo-stack/the-concepts-of-graphql-bc68bd819be3#.3mb0cbcmc) for
   * a description of store reactivity.
   */
  public watchQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloClient.WatchQueryOptions<TData, TVariables>
  ): ObservableQuery<TData, TVariables> {
    if (this.defaultOptions.watchQuery) {
      options = mergeOptions(
        this.defaultOptions.watchQuery as Partial<
          ApolloClient.WatchQueryOptions<TData, TVariables>
        >,
        options
      );
    }

    return this.queryManager.watchQuery<TData, TVariables>(options);
  }

  /**
   * This resolves a single query according to the options specified and
   * returns a `Promise` which is either resolved with the resulting data
   * or rejected with an error.
   *
   * @param options - An object of type `QueryOptions` that allows us to
   * describe how this query should be treated e.g. whether it should hit the
   * server at all or just resolve from the cache, etc.
   */
  public query<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloClient.QueryOptions<TData, TVariables>
  ): Promise<ApolloClient.QueryResult<MaybeMasked<TData>>> {
    if (this.defaultOptions.query) {
      options = mergeOptions(this.defaultOptions.query, options);
    }

    if (__DEV__) {
      invariant(
        (options.fetchPolicy as WatchQueryFetchPolicy) !== "cache-and-network",
        "The cache-and-network fetchPolicy does not work with client.query, because " +
          "client.query can only return a single result. Please use client.watchQuery " +
          "to receive multiple results from the cache and the network, or consider " +
          "using a different fetchPolicy, such as cache-first or network-only."
      );

      invariant(
        (options.fetchPolicy as WatchQueryFetchPolicy) !== "standby",
        "The standby fetchPolicy does not work with client.query, because " +
          "standby does not fetch. Consider using a different fetchPolicy, such " +
          "as cache-first or network-only."
      );

      invariant(
        options.query,
        "query option is required. You must specify your GraphQL document " +
          "in the query option."
      );

      invariant(
        options.query.kind === "Document",
        'You must wrap the query string in a "gql" tag.'
      );

      invariant(
        !(options as any).returnPartialData,
        "returnPartialData option only supported on watchQuery."
      );

      invariant(
        !(options as any).pollInterval,
        "pollInterval option only supported on watchQuery."
      );

      invariant(
        !(options as any).notifyOnNetworkStatusChange,
        "notifyOnNetworkStatusChange option only supported on watchQuery."
      );
    }

    return this.queryManager.query<TData, TVariables>(options);
  }

  /**
   * This resolves a single mutation according to the options specified and returns a
   * Promise which is either resolved with the resulting data or rejected with an
   * error. In some cases both `data` and `errors` might be undefined, for example
   * when `errorPolicy` is set to `'ignore'`.
   *
   * It takes options as an object with the following keys and values:
   */
  public mutate<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
    TCache extends ApolloCache = ApolloCache,
  >(
    options: ApolloClient.MutateOptions<TData, TVariables, TCache>
  ): Promise<ApolloClient.MutateResult<MaybeMasked<TData>>> {
    const optionsWithDefaults = mergeOptions(
      compact(
        {
          fetchPolicy: "network-only" as MutationFetchPolicy,
          errorPolicy: "none" as ErrorPolicy,
        },
        this.defaultOptions.mutate
      ),
      options
    ) as ApolloClient.MutateOptions<TData, TVariables, TCache> & {
      fetchPolicy: MutationFetchPolicy;
      errorPolicy: ErrorPolicy;
    };

    if (__DEV__) {
      invariant(
        optionsWithDefaults.mutation,
        "The `mutation` option is required. Please provide a GraphQL document in the `mutation` option."
      );

      invariant(
        optionsWithDefaults.fetchPolicy === "network-only" ||
          optionsWithDefaults.fetchPolicy === "no-cache",
        "Mutations only support 'network-only' or 'no-cache' fetch policies. The default 'network-only' behavior automatically writes mutation results to the cache. Passing 'no-cache' skips the cache write."
      );
    }

    checkDocument(optionsWithDefaults.mutation, OperationTypeNode.MUTATION);

    return this.queryManager.mutate<TData, TVariables, TCache>(
      optionsWithDefaults
    );
  }

  /**
   * This subscribes to a graphql subscription according to the options specified and returns an
   * `Observable` which either emits received data or an error.
   */
  public subscribe<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloClient.SubscribeOptions<TData, TVariables>
  ): SubscriptionObservable<ApolloClient.SubscribeResult<MaybeMasked<TData>>> {
    const cause = {};

    const observable =
      this.queryManager.startGraphQLSubscription<TData>(options);

    const mapped = observable.pipe(
      map((result) => ({
        ...result,
        data: this.queryManager.maskOperation({
          document: options.query,
          data: result.data,
          fetchPolicy: options.fetchPolicy,
          cause,
        }),
      }))
    );

    return Object.assign(mapped, { restart: observable.restart });
  }

  /**
   * Tries to read some data from the store in the shape of the provided
   * GraphQL query without making a network request. This method will start at
   * the root query. To start at a specific id returned by `cache.identify`
   * use `readFragment`.
   *
   * @param optimistic - Set to `true` to allow `readQuery` to return
   * optimistic results. Is `false` by default.
   */
  public readQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloClient.ReadQueryOptions<TData, TVariables>
  ): Unmasked<TData> | null;

  /**
   * {@inheritDoc @apollo/client!ApolloClient#readQuery:member(1)}
   *
   * @deprecated Pass the `optimistic` argument as part of the first argument
   * instead of passing it as a separate option.
   */
  public readQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloClient.ReadQueryOptions<TData, TVariables>,
    /**
     * @deprecated Pass the `optimistic` argument as part of the first argument
     * instead of passing it as a separate option.
     */
    optimistic: boolean
  ): Unmasked<TData> | null;

  public readQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloClient.ReadQueryOptions<TData, TVariables>,
    optimistic: boolean = false
  ): Unmasked<TData> | null {
    return this.cache.readQuery<TData, TVariables>(
      { ...options, query: this.transform(options.query) },
      optimistic
    );
  }

  /**
   * Watches the cache store of the fragment according to the options specified
   * and returns an `Observable`. We can subscribe to this
   * `Observable` and receive updated results through an
   * observer when the cache store changes.
   *
   * You must pass in a GraphQL document with a single fragment or a document
   * with multiple fragments that represent what you are reading. If you pass
   * in a document with multiple fragments then you must also specify a
   * `fragmentName`.
   *
   * @since 3.10.0
   * @param options - An object of type `WatchFragmentOptions` that allows
   * the cache to identify the fragment and optionally specify whether to react
   * to optimistic updates.
   */

  public watchFragment<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloClient.WatchFragmentOptions<TData, TVariables>
  ): Observable<ApolloClient.WatchFragmentResult<MaybeMasked<TData>>> {
    const dataMasking = this.queryManager.dataMasking;

    return this.cache
      .watchFragment({
        ...options,
        fragment: this.transform(options.fragment, dataMasking),
      })
      .pipe(
        map((result) => {
          // The transform will remove fragment spreads from the fragment
          // document when dataMasking is enabled. The `maskFragment` function
          // remains to apply warnings to fragments marked as
          // `@unmask(mode: "migrate")`. Since these warnings are only applied
          // in dev, we can skip the masking algorithm entirely for production.
          if (__DEV__) {
            if (dataMasking) {
              const data = this.queryManager.maskFragment({
                ...options,
                data: result.data,
              });
              return { ...result, data } as ApolloClient.WatchFragmentResult<
                MaybeMasked<TData>
              >;
            }
          }

          return result as ApolloClient.WatchFragmentResult<MaybeMasked<TData>>;
        })
      );
  }

  /**
   * Tries to read some data from the store in the shape of the provided
   * GraphQL fragment without making a network request. This method will read a
   * GraphQL fragment from any arbitrary id that is currently cached, unlike
   * `readQuery` which will only read from the root query.
   *
   * You must pass in a GraphQL document with a single fragment or a document
   * with multiple fragments that represent what you are reading. If you pass
   * in a document with multiple fragments then you must also specify a
   * `fragmentName`.
   *
   * @param optimistic - Set to `true` to allow `readFragment` to return
   * optimistic results. Is `false` by default.
   */
  public readFragment<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloClient.ReadFragmentOptions<TData, TVariables>
  ): Unmasked<TData> | null;
  /**
   * {@inheritDoc @apollo/client!ApolloClient#readFragment:member(1)}
   *
   * @deprecated Pass the `optimistic` argument as part of the first argument
   * instead of passing it as a separate option.
   */
  public readFragment<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloClient.ReadFragmentOptions<TData, TVariables>,
    optimistic: boolean
  ): Unmasked<TData> | null;

  public readFragment<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloClient.ReadFragmentOptions<TData, TVariables>,
    optimistic: boolean = false
  ): Unmasked<TData> | null {
    return this.cache.readFragment<TData, TVariables>(
      { ...options, fragment: this.transform(options.fragment) },
      optimistic
    );
  }

  /**
   * Writes some data in the shape of the provided GraphQL query directly to
   * the store. This method will start at the root query. To start at a
   * specific id returned by `cache.identify` then use `writeFragment`.
   */
  public writeQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloClient.WriteQueryOptions<TData, TVariables>
  ): Reference | undefined {
    const ref = this.cache.writeQuery<TData, TVariables>(options);

    if (options.broadcast !== false) {
      this.queryManager.broadcastQueries();
    }

    return ref;
  }

  /**
   * Writes some data in the shape of the provided GraphQL fragment directly to
   * the store. This method will write to a GraphQL fragment from any arbitrary
   * id that is currently cached, unlike `writeQuery` which will only write
   * from the root query.
   *
   * You must pass in a GraphQL document with a single fragment or a document
   * with multiple fragments that represent what you are writing. If you pass
   * in a document with multiple fragments then you must also specify a
   * `fragmentName`.
   */
  public writeFragment<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloClient.WriteFragmentOptions<TData, TVariables>
  ): Reference | undefined {
    const ref = this.cache.writeFragment<TData, TVariables>(options);

    if (options.broadcast !== false) {
      this.queryManager.broadcastQueries();
    }

    return ref;
  }

  public __actionHookForDevTools(cb: () => any) {
    this.devToolsHookCb = cb;
  }

  public __requestRaw(
    request: ApolloLink.Request
  ): Observable<ApolloLink.Result<unknown>> {
    return execute(this.link, request, { client: this });
  }

  /**
   * Resets your entire store by clearing out your cache and then re-executing
   * all of your active queries. This makes it so that you may guarantee that
   * there is no data left in your store from a time before you called this
   * method.
   *
   * `resetStore()` is useful when your user just logged out. You’ve removed the
   * user session, and you now want to make sure that any references to data you
   * might have fetched while the user session was active is gone.
   *
   * It is important to remember that `resetStore()` _will_ refetch any active
   * queries. This means that any components that might be mounted will execute
   * their queries again using your network interface. If you do not want to
   * re-execute any queries then you should make sure to stop watching any
   * active queries.
   */
  public resetStore(): Promise<ApolloClient.QueryResult<any>[] | null> {
    return Promise.resolve()
      .then(() =>
        this.queryManager.clearStore({
          discardWatches: false,
        })
      )
      .then(() => Promise.all(this.resetStoreCallbacks.map((fn) => fn())))
      .then(() => this.refetchObservableQueries());
  }

  /**
   * Remove all data from the store. Unlike `resetStore`, `clearStore` will
   * not refetch any active queries.
   */
  public clearStore(): Promise<any[]> {
    return Promise.resolve()
      .then(() =>
        this.queryManager.clearStore({
          discardWatches: true,
        })
      )
      .then(() => Promise.all(this.clearStoreCallbacks.map((fn) => fn())));
  }

  /**
   * Allows callbacks to be registered that are executed when the store is
   * reset. `onResetStore` returns an unsubscribe function that can be used
   * to remove registered callbacks.
   */
  public onResetStore(cb: () => Promise<any>): () => void {
    this.resetStoreCallbacks.push(cb);
    return () => {
      this.resetStoreCallbacks = this.resetStoreCallbacks.filter(
        (c) => c !== cb
      );
    };
  }

  /**
   * Allows callbacks to be registered that are executed when the store is
   * cleared. `onClearStore` returns an unsubscribe function that can be used
   * to remove registered callbacks.
   */
  public onClearStore(cb: () => Promise<any>): () => void {
    this.clearStoreCallbacks.push(cb);
    return () => {
      this.clearStoreCallbacks = this.clearStoreCallbacks.filter(
        (c) => c !== cb
      );
    };
  }

  /**
   * Refetches all of your active queries.
   *
   * `reFetchObservableQueries()` is useful if you want to bring the client back to proper state in case of a network outage
   *
   * It is important to remember that `reFetchObservableQueries()` _will_ refetch any active
   * queries. This means that any components that might be mounted will execute
   * their queries again using your network interface. If you do not want to
   * re-execute any queries then you should make sure to stop watching any
   * active queries.
   * Takes optional parameter `includeStandby` which will include queries in standby-mode when refetching.
   *
   * Note: `cache-only` queries are not refetched by this function.
   *
   * @deprecated Please use `refetchObservableQueries` instead.
   */
  public reFetchObservableQueries: (
    includeStandby?: boolean
  ) => Promise<ApolloClient.QueryResult<any>[]>;

  /**
   * Refetches all of your active queries.
   *
   * `refetchObservableQueries()` is useful if you want to bring the client back to proper state in case of a network outage
   *
   * It is important to remember that `refetchObservableQueries()` _will_ refetch any active
   * queries. This means that any components that might be mounted will execute
   * their queries again using your network interface. If you do not want to
   * re-execute any queries then you should make sure to stop watching any
   * active queries.
   * Takes optional parameter `includeStandby` which will include queries in standby-mode when refetching.
   *
   * Note: `cache-only` queries are not refetched by this function.
   */
  public refetchObservableQueries(
    includeStandby?: boolean
  ): Promise<ApolloClient.QueryResult<any>[]> {
    return this.queryManager.refetchObservableQueries(includeStandby);
  }

  /**
   * Refetches specified active queries. Similar to "refetchObservableQueries()" but with a specific list of queries.
   *
   * `refetchQueries()` is useful for use cases to imperatively refresh a selection of queries.
   *
   * It is important to remember that `refetchQueries()` _will_ refetch specified active
   * queries. This means that any components that might be mounted will execute
   * their queries again using your network interface. If you do not want to
   * re-execute any queries then you should make sure to stop watching any
   * active queries.
   */
  public refetchQueries<
    TCache extends ApolloCache = ApolloCache,
    TResult = Promise<ApolloClient.QueryResult<any>>,
  >(
    options: ApolloClient.RefetchQueriesOptions<TCache, TResult>
  ): ApolloClient.RefetchQueriesResult<TResult> {
    const map = this.queryManager.refetchQueries(
      options as ApolloClient.RefetchQueriesOptions<ApolloCache, TResult>
    );
    const queries: ObservableQuery<any>[] = [];
    const results: InternalRefetchQueriesResult<TResult>[] = [];

    map.forEach((result, obsQuery) => {
      queries.push(obsQuery);
      results.push(result);
    });

    const result = Promise.all<TResult>(
      results as TResult[]
    ) as ApolloClient.RefetchQueriesResult<TResult>;

    // In case you need the raw results immediately, without awaiting
    // Promise.all(results):
    result.queries = queries;
    result.results = results;

    // If you decide to ignore the result Promise because you're using
    // result.queries and result.results instead, you shouldn't have to worry
    // about preventing uncaught rejections for the Promise.all result.
    result.catch((error) => {
      invariant.debug(
        `In client.refetchQueries, Promise.all promise rejected with error %o`,
        error
      );
    });

    return result;
  }

  /**
   * Get all currently active `ObservableQuery` objects, in a `Set`.
   *
   * An "active" query is one that has observers and a `fetchPolicy` other than
   * "standby" or "cache-only".
   *
   * You can include all `ObservableQuery` objects (including the inactive ones)
   * by passing "all" instead of "active", or you can include just a subset of
   * active queries by passing an array of query names or DocumentNode objects.
   *
   * Note: This method only returns queries that have active subscribers. Queries
   * without subscribers are not tracked by the client.
   */
  public getObservableQueries(
    include: RefetchQueriesInclude = "active"
  ): Set<ObservableQuery<any>> {
    return this.queryManager.getObservableQueries(include);
  }

  /**
   * Exposes the cache's complete state, in a serializable format for later restoration.
   *
   * @remarks
   *
   * This can be useful for debugging in order to inspect the full state of the
   * cache.
   *
   * @param optimistic - Determines whether the result contains data from the
   * optimistic layer
   */
  public extract(optimistic?: boolean) {
    return this.cache.extract(optimistic);
  }

  /**
   * Replaces existing state in the cache (if any) with the values expressed by
   * `serializedState`.
   *
   * Called when hydrating a cache (server side rendering, or offline storage),
   * and also (potentially) during hot reloads.
   */
  public restore(serializedState: unknown) {
    return this.cache.restore(serializedState);
  }

  /**
   * Define a new ApolloLink (or link chain) that Apollo Client will use.
   */
  public setLink(newLink: ApolloLink) {
    this.link = newLink;
  }

  public get defaultContext() {
    return this.queryManager.defaultContext;
  }

  private maskedFragmentTransform = new DocumentTransform(
    removeMaskedFragmentSpreads
  );

  private transform(document: DocumentNode, dataMasking = false) {
    const transformed = this.queryManager.transform(document);
    return dataMasking ?
        this.maskedFragmentTransform.transformDocument(transformed)
      : transformed;
  }

  /**
   * @experimental
   * This is not a stable API - it is used in development builds to expose
   * information to the DevTools.
   * Use at your own risk!
   * For more details, see [Memory Management](https://www.apollographql.com/docs/react/caching/memory-management/#measuring-cache-usage)
   *
   * @example
   *
   * ```ts
   * console.log(client.getMemoryInternals());
   * ```
   *
   * Logs output in the following JSON format:
   * @example
   *
   * ```json
   * {
   *   "limits": {
   *     "canonicalStringify": 1000,
   *     "print": 2000,
   *     "documentTransform.cache": 2000,
   *     "queryManager.getDocumentInfo": 2000,
   *     "PersistedQueryLink.persistedQueryHashes": 2000,
   *     "fragmentRegistry.transform": 2000,
   *     "fragmentRegistry.lookup": 1000,
   *     "fragmentRegistry.findFragmentSpreads": 4000,
   *     "cache.fragmentQueryDocuments": 1000,
   *     "removeTypenameFromVariables.getVariableDefinitions": 2000,
   *     "inMemoryCache.maybeBroadcastWatch": 5000,
   *     "inMemoryCache.executeSelectionSet": 10000,
   *     "inMemoryCache.executeSubSelectedArray": 5000
   *   },
   *   "sizes": {
   *     "canonicalStringify": 4,
   *     "print": 14,
   *     "addTypenameDocumentTransform": [
   *       {
   *         "cache": 14
   *       }
   *     ],
   *     "queryManager": {
   *       "getDocumentInfo": 14,
   *       "documentTransforms": [
   *         {
   *           "cache": 14
   *         },
   *         {
   *           "cache": 14
   *         }
   *       ]
   *     },
   *     "fragmentRegistry": {
   *       "findFragmentSpreads": 34,
   *       "lookup": 20,
   *       "transform": 14
   *     },
   *     "cache": {
   *       "fragmentQueryDocuments": 22
   *     },
   *     "inMemoryCache": {
   *       "executeSelectionSet": 4345,
   *       "executeSubSelectedArray": 1206,
   *       "maybeBroadcastWatch": 32
   *     },
   *     "links": [
   *       {
   *         "PersistedQueryLink": {
   *           "persistedQueryHashes": 14
   *         }
   *       },
   *       {
   *         "removeTypenameFromVariables": {
   *           "getVariableDefinitions": 14
   *         }
   *       }
   *     ]
   *   }
   * }
   * ```
   */
  public declare getMemoryInternals?: typeof getApolloClientMemoryInternals;
}

if (__DEV__) {
  ApolloClient.prototype.getMemoryInternals = getApolloClientMemoryInternals;
}
