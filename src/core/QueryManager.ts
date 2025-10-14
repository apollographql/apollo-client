import { Trie } from "@wry/trie";
import type {
  DirectiveNode,
  DocumentNode,
  FormattedExecutionResult,
} from "graphql";
import { BREAK, Kind, OperationTypeNode, visit } from "graphql";
import { Observable, throwError } from "rxjs";
import {
  catchError,
  concat,
  EMPTY,
  filter,
  finalize,
  from,
  lastValueFrom,
  map,
  materialize,
  mergeMap,
  of,
  share,
  shareReplay,
  Subject,
  tap,
} from "rxjs";

import type { ApolloCache, Cache } from "@apollo/client/cache";
import { canonicalStringify } from "@apollo/client/cache";
import {
  CombinedGraphQLErrors,
  graphQLResultHasProtocolErrors,
  registerLinkError,
  toErrorLike,
} from "@apollo/client/errors";
import { PROTOCOL_ERRORS_SYMBOL } from "@apollo/client/errors";
import type { Incremental } from "@apollo/client/incremental";
import type { ApolloLink } from "@apollo/client/link";
import { execute } from "@apollo/client/link";
import type { LocalState } from "@apollo/client/local-state";
import type { MaybeMasked } from "@apollo/client/masking";
import { maskFragment, maskOperation } from "@apollo/client/masking";
import type { DeepPartial } from "@apollo/client/utilities";
import {
  cacheSizes,
  DocumentTransform,
  isNetworkRequestInFlight,
  print,
} from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import {
  AutoCleanedWeakCache,
  checkDocument,
  filterMap,
  getDefaultValues,
  getOperationDefinition,
  getOperationName,
  graphQLResultHasError,
  hasDirectives,
  hasForcedResolvers,
  isDocumentNode,
  isNonNullObject,
  makeUniqueId,
  removeDirectivesFromDocument,
  toQueryResult,
} from "@apollo/client/utilities/internal";
import {
  invariant,
  newInvariantError,
} from "@apollo/client/utilities/invariant";

import { defaultCacheSizes } from "../utilities/caching/sizes.js";

import type { ApolloClient } from "./ApolloClient.js";
import { NetworkStatus } from "./networkStatus.js";
import { logMissingFieldErrors, ObservableQuery } from "./ObservableQuery.js";
import { CacheWriteBehavior, QueryInfo } from "./QueryInfo.js";
import type {
  DefaultContext,
  InternalRefetchQueriesInclude,
  InternalRefetchQueriesMap,
  InternalRefetchQueriesOptions,
  InternalRefetchQueriesResult,
  OperationVariables,
  QueryNotification,
  SubscriptionObservable,
  TypedDocumentNode,
} from "./types.js";
import type {
  ErrorPolicy,
  MutationFetchPolicy,
  WatchQueryFetchPolicy,
} from "./watchQueryOptions.js";

interface MutationStoreValue {
  mutation: DocumentNode;
  variables: Record<string, any>;
  loading: boolean;
  error: Error | null;
}

interface TransformCacheEntry {
  hasClientExports: boolean;
  hasForcedResolvers: boolean;
  hasNonreactiveDirective: boolean;
  hasIncrementalDirective: boolean;
  nonReactiveQuery: DocumentNode;
  clientQuery: DocumentNode | null;
  serverQuery: DocumentNode | null;
  defaultVars: OperationVariables;
  asQuery: DocumentNode;
  operationType: OperationTypeNode | undefined;
  violation?: Error | undefined;
}

interface MaskFragmentOptions<TData> {
  fragment: DocumentNode;
  data: TData;
  fragmentName?: string;
}

interface MaskOperationOptions<TData> {
  document: DocumentNode;
  data: TData;
  /**
   * Can be used to identify the cause to prevent warning for the same cause twice.
   * This would be an object like e.g. an `ObervableQuery`.
   * If the `cause` is not provided, we will warn every time.
   */
  cause?: object;
  fetchPolicy?: WatchQueryFetchPolicy;
}

interface QueryManagerOptions {
  client: ApolloClient;
  clientOptions: ApolloClient.Options;
  defaultOptions: ApolloClient.DefaultOptions;
  documentTransform: DocumentTransform | null | undefined;
  queryDeduplication: boolean;
  onBroadcast: undefined | (() => void);
  ssrMode: boolean;
  assumeImmutableResults: boolean;
  defaultContext: Partial<DefaultContext> | undefined;
  dataMasking: boolean;
  localState: LocalState | undefined;
  incrementalHandler: Incremental.Handler;
}

export class QueryManager {
  public defaultOptions: ApolloClient.DefaultOptions;

  public readonly client: ApolloClient;
  /**
   * The options that were passed to the ApolloClient constructor.
   */
  public readonly clientOptions: ApolloClient.Options;
  public readonly assumeImmutableResults: boolean;
  public readonly documentTransform: DocumentTransform;
  public readonly ssrMode: boolean;
  public readonly defaultContext: Partial<DefaultContext>;
  public readonly dataMasking: boolean;
  public readonly incrementalHandler: Incremental.Handler;
  public localState: LocalState | undefined;

  private queryDeduplication: boolean;

  /**
   * Whether to prioritize cache values over network results when
   * `fetchObservableWithInfo` is called.
   * This will essentially turn a `"network-only"` or `"cache-and-network"`
   * fetchPolicy into a `"cache-first"` fetchPolicy, but without influencing
   * the `fetchPolicy` of the `ObservableQuery`.
   *
   * This can e.g. be used to prioritize the cache during the first render after
   * SSR.
   */
  public prioritizeCacheValues: boolean = false;

  private onBroadcast?: () => void;
  public mutationStore?: {
    [mutationId: string]: MutationStoreValue;
  };

  /**
   * All ObservableQueries that currently have at least one subscriber.
   */
  public obsQueries = new Set<ObservableQuery<any, any>>();

  // Maps from queryInfo.id strings to Promise rejection functions for
  // currently active queries and fetches.
  // Use protected instead of private field so
  // @apollo/experimental-nextjs-app-support can access type info.
  protected fetchCancelFns = new Map<string, (error: any) => any>();

  constructor(options: QueryManagerOptions) {
    const defaultDocumentTransform = new DocumentTransform(
      (document) => this.cache.transformDocument(document),
      // Allow the apollo cache to manage its own transform caches
      { cache: false }
    );

    this.client = options.client;
    this.defaultOptions = options.defaultOptions;
    this.queryDeduplication = options.queryDeduplication;
    this.clientOptions = options.clientOptions;
    this.ssrMode = options.ssrMode;
    this.assumeImmutableResults = options.assumeImmutableResults;
    this.dataMasking = options.dataMasking;
    this.localState = options.localState;
    this.incrementalHandler = options.incrementalHandler;
    const documentTransform = options.documentTransform;
    this.documentTransform =
      documentTransform ?
        defaultDocumentTransform
          .concat(documentTransform)
          // The custom document transform may add new fragment spreads or new
          // field selections, so we want to give the cache a chance to run
          // again. For example, the InMemoryCache adds __typename to field
          // selections and fragments from the fragment registry.
          .concat(defaultDocumentTransform)
      : defaultDocumentTransform;
    this.defaultContext = options.defaultContext || {};

    if ((this.onBroadcast = options.onBroadcast)) {
      this.mutationStore = {};
    }
  }

  get link() {
    return this.client.link;
  }

  get cache() {
    return this.client.cache;
  }

  /**
   * Call this method to terminate any active query processes, making it safe
   * to dispose of this QueryManager instance.
   */
  public stop() {
    this.obsQueries.forEach((oq) => oq.stop());

    this.cancelPendingFetches(
      newInvariantError("QueryManager stopped while query was in flight")
    );
  }

  private cancelPendingFetches(error: Error) {
    this.fetchCancelFns.forEach((cancel) => cancel(error));
    this.fetchCancelFns.clear();
  }

  public async mutate<
    TData,
    TVariables extends OperationVariables,
    TCache extends ApolloCache,
  >({
    mutation,
    variables,
    optimisticResponse,
    updateQueries,
    refetchQueries = [],
    awaitRefetchQueries = false,
    update: updateWithProxyFn,
    onQueryUpdated,
    fetchPolicy,
    errorPolicy,
    keepRootFields,
    context,
  }: ApolloClient.MutateOptions<TData, TVariables, TCache> & {
    errorPolicy: ErrorPolicy;
    fetchPolicy: MutationFetchPolicy;
  }): Promise<ApolloClient.MutateResult<MaybeMasked<TData>>> {
    const queryInfo = new QueryInfo<TData, TVariables, TCache>(this);

    mutation = this.cache.transformForLink(this.transform(mutation));
    const { hasClientExports } = this.getDocumentInfo(mutation);

    variables = this.getVariables(mutation, variables);

    if (hasClientExports) {
      if (__DEV__) {
        invariant(
          this.localState,
          "Mutation '%s' contains `@client` fields with variables provided by `@export` but local state has not been configured.",
          getOperationName(mutation, "(anonymous)")
        );
      }

      variables = await this.localState!.getExportedVariables<TVariables>({
        client: this.client,
        document: mutation,
        variables,
        context,
      });
    }

    const mutationStoreValue =
      this.mutationStore &&
      (this.mutationStore[queryInfo.id] = {
        mutation,
        variables,
        loading: true,
        error: null,
      } as MutationStoreValue);

    const isOptimistic =
      optimisticResponse &&
      queryInfo.markMutationOptimistic(optimisticResponse, {
        document: mutation,
        variables,
        cacheWriteBehavior:
          fetchPolicy === "no-cache" ?
            CacheWriteBehavior.FORBID
          : CacheWriteBehavior.MERGE,
        errorPolicy,
        context,
        updateQueries,
        update: updateWithProxyFn,
        keepRootFields,
      });

    this.broadcastQueries();

    return new Promise((resolve, reject) => {
      const cause = {};
      return this.getObservableFromLink<TData>(
        mutation,
        {
          ...context,
          optimisticResponse: isOptimistic ? optimisticResponse : void 0,
        },
        variables,
        {},
        false
      )
        .observable.pipe(
          validateDidEmitValue(),
          mergeMap((result) => {
            const storeResult: typeof result = { ...result };

            return from(
              queryInfo.markMutationResult(storeResult, {
                document: mutation,
                variables,
                cacheWriteBehavior:
                  fetchPolicy === "no-cache" ?
                    CacheWriteBehavior.FORBID
                  : CacheWriteBehavior.MERGE,
                errorPolicy,
                context,
                update: updateWithProxyFn,
                updateQueries,
                awaitRefetchQueries,
                refetchQueries,
                removeOptimistic: isOptimistic ? queryInfo.id : void 0,
                onQueryUpdated,
                keepRootFields,
              })
            );
          })
        )
        .pipe(
          map((storeResult) => {
            const hasErrors = graphQLResultHasError(storeResult);
            if (hasErrors && errorPolicy === "none") {
              throw new CombinedGraphQLErrors(storeResult);
            }

            if (mutationStoreValue) {
              mutationStoreValue.loading = false;
              mutationStoreValue.error = null;
            }

            return storeResult;
          })
        )
        .subscribe({
          next: (storeResult) => {
            this.broadcastQueries();

            // Since mutations might receive multiple payloads from the
            // ApolloLink chain (e.g. when used with @defer),
            // we resolve with a SingleExecutionResult or after the final
            // ExecutionPatchResult has arrived and we have assembled the
            // multipart response into a single result.
            if (!queryInfo.hasNext) {
              const result: ApolloClient.MutateResult<TData> = {
                data: this.maskOperation({
                  document: mutation,
                  data: storeResult.data,
                  fetchPolicy,
                  cause,
                }) as any,
              };

              if (graphQLResultHasError(storeResult)) {
                result.error = new CombinedGraphQLErrors(storeResult);
              }

              if (Object.keys(storeResult.extensions || {}).length) {
                result.extensions = storeResult.extensions;
              }

              resolve(result);
            }
          },

          error: (error) => {
            if (mutationStoreValue) {
              mutationStoreValue.loading = false;
              mutationStoreValue.error = error;
            }

            if (isOptimistic) {
              this.cache.removeOptimistic(queryInfo.id);
            }

            this.broadcastQueries();

            if (errorPolicy === "ignore") {
              return resolve({ data: undefined });
            }

            if (errorPolicy === "all") {
              return resolve({ data: undefined, error });
            }

            reject(error);
          },
        });
    });
  }

  public fetchQuery<TData, TVariables extends OperationVariables>(
    options: ApolloClient.WatchQueryOptions<TData, TVariables>,
    networkStatus?: NetworkStatus
  ): Promise<ApolloClient.QueryResult<TData>> {
    checkDocument(options.query, OperationTypeNode.QUERY);

    // do the rest asynchronously to keep the same rejection timing as
    // checks further in `.mutate`
    return (async () =>
      lastValueFrom(
        this.fetchObservableWithInfo(options, {
          networkStatus,
        }).observable.pipe(
          filterMap((value) => {
            switch (value.kind) {
              case "E":
                throw value.error;
              case "N": {
                if (value.source !== "newNetworkStatus")
                  return toQueryResult(value.value);
              }
            }
          })
        ),
        {
          // This default is needed when a `standby` fetch policy is used to avoid
          // an EmptyError from rejecting this promise.
          defaultValue: { data: undefined },
        }
      ))();
  }

  public transform(document: DocumentNode) {
    return this.documentTransform.transformDocument(document);
  }

  private transformCache = new AutoCleanedWeakCache<
    DocumentNode,
    TransformCacheEntry
  >(
    cacheSizes["queryManager.getDocumentInfo"] ||
      defaultCacheSizes["queryManager.getDocumentInfo"]
  );

  public getDocumentInfo(document: DocumentNode) {
    const { transformCache } = this;

    if (!transformCache.has(document)) {
      const operationDefinition = getOperationDefinition(document);

      const cacheEntry: TransformCacheEntry = {
        // TODO These three calls (hasClientExports, shouldForceResolvers, and
        // usesNonreactiveDirective) are performing independent full traversals
        // of the transformed document. We should consider merging these
        // traversals into a single pass in the future, though the work is
        // cached after the first time.
        hasClientExports: hasDirectives(["client", "export"], document, true),
        hasForcedResolvers: hasForcedResolvers(document),
        hasNonreactiveDirective: hasDirectives(["nonreactive"], document),
        hasIncrementalDirective: hasDirectives(["defer"], document),
        nonReactiveQuery: addNonReactiveToNamedFragments(document),
        clientQuery: hasDirectives(["client"], document) ? document : null,
        serverQuery: removeDirectivesFromDocument(
          [
            { name: "client", remove: true },
            { name: "connection" },
            { name: "nonreactive" },
            { name: "unmask" },
          ],
          document
        ),
        operationType: operationDefinition?.operation,
        defaultVars: getDefaultValues(
          operationDefinition
        ) as OperationVariables,
        // Transform any mutation or subscription operations to query operations
        // so we can read/write them from/to the cache.
        asQuery: {
          ...document,
          definitions: document.definitions.map((def) => {
            if (
              def.kind === "OperationDefinition" &&
              def.operation !== "query"
            ) {
              return { ...def, operation: "query" as OperationTypeNode };
            }
            return def;
          }),
        },
      };

      transformCache.set(document, cacheEntry);
    }

    const entry = transformCache.get(document)!;
    if (entry.violation) {
      throw entry.violation;
    }
    return entry;
  }

  public getVariables<TVariables extends OperationVariables>(
    document: DocumentNode,
    variables?: TVariables
  ): TVariables {
    const defaultVars = this.getDocumentInfo(document).defaultVars;
    const varsWithDefaults = Object.entries(variables ?? {}).map(
      ([key, value]) => [key, value === undefined ? defaultVars[key] : value]
    );

    return {
      ...defaultVars,
      ...Object.fromEntries(varsWithDefaults),
    };
  }

  public watchQuery<
    TData,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloClient.WatchQueryOptions<TData, TVariables>
  ): ObservableQuery<TData, TVariables> {
    checkDocument(options.query, OperationTypeNode.QUERY);

    const query = this.transform(options.query);

    // assign variable default values if supplied
    // NOTE: We don't modify options.query here with the transformed query to
    // ensure observable.options.query is set to the raw untransformed query.
    options = {
      ...options,
      variables: this.getVariables(query, options.variables) as TVariables,
    };

    if (typeof options.notifyOnNetworkStatusChange === "undefined") {
      options.notifyOnNetworkStatusChange = true;
    }

    const observable = new ObservableQuery<TData, TVariables>({
      queryManager: this,
      options,
      transformedQuery: query,
    });

    return observable;
  }

  public query<
    TData,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloClient.QueryOptions<TData, TVariables>
  ): Promise<ApolloClient.QueryResult<MaybeMasked<TData>>> {
    const query = this.transform(options.query);

    return this.fetchQuery<TData, TVariables>({
      ...(options as any),
      query,
    }).then((value) => ({
      ...value,
      data: this.maskOperation({
        document: query,
        data: value?.data,
        fetchPolicy: options.fetchPolicy,
      }),
    }));
  }

  private requestIdCounter = 1;
  public generateRequestId() {
    return this.requestIdCounter++;
  }

  public clearStore(
    options: Cache.ResetOptions = {
      discardWatches: true,
    }
  ): Promise<void> {
    // Before we have sent the reset action to the store, we can no longer
    // rely on the results returned by in-flight requests since these may
    // depend on values that previously existed in the data portion of the
    // store. So, we cancel the promises and observers that we have issued
    // so far and not yet resolved (in the case of queries).
    this.cancelPendingFetches(
      newInvariantError(
        "Store reset while query was in flight (not completed in link chain)"
      )
    );

    this.obsQueries.forEach((observableQuery) => {
      // Set loading to true so listeners don't trigger unless they want
      // results with partial data.
      observableQuery.reset();
    });

    if (this.mutationStore) {
      this.mutationStore = {};
    }

    // begin removing data from the store
    return this.cache.reset(options);
  }

  public getObservableQueries(
    include: InternalRefetchQueriesInclude = "active"
  ) {
    const queries = new Set<ObservableQuery<any>>();
    const queryNames = new Map<string, string | undefined>();
    const queryNamesAndQueryStrings = new Map<string, boolean>();
    const legacyQueryOptions = new Set<ApolloClient.QueryOptions>();

    if (Array.isArray(include)) {
      include.forEach((desc) => {
        if (typeof desc === "string") {
          queryNames.set(desc, desc);
          queryNamesAndQueryStrings.set(desc, false);
        } else if (isDocumentNode(desc)) {
          const queryString = print(this.transform(desc));
          queryNames.set(queryString, getOperationName(desc));
          queryNamesAndQueryStrings.set(queryString, false);
        } else if (isNonNullObject(desc) && desc.query) {
          legacyQueryOptions.add(desc);
        }
      });
    }

    this.obsQueries.forEach((oq) => {
      const document = print(this.transform(oq.options.query));
      if (include === "all") {
        queries.add(oq);
        return;
      }

      const {
        queryName,
        options: { fetchPolicy },
      } = oq;

      if (include === "active" && fetchPolicy === "standby") {
        return;
      }

      if (
        include === "active" ||
        (queryName && queryNamesAndQueryStrings.has(queryName)) ||
        (document && queryNamesAndQueryStrings.has(document))
      ) {
        queries.add(oq);
        if (queryName) queryNamesAndQueryStrings.set(queryName, true);
        if (document) queryNamesAndQueryStrings.set(document, true);
      }
    });

    if (legacyQueryOptions.size) {
      legacyQueryOptions.forEach((options) => {
        const oq = new ObservableQuery({
          queryManager: this,
          options: {
            ...options,
            fetchPolicy: "network-only",
          },
        });
        queries.add(oq);
      });
    }

    if (__DEV__ && queryNamesAndQueryStrings.size) {
      queryNamesAndQueryStrings.forEach((included, nameOrQueryString) => {
        if (!included) {
          const queryName = queryNames.get(nameOrQueryString);

          if (queryName) {
            invariant.warn(
              `Unknown query named "%s" requested in refetchQueries options.include array`,
              queryName
            );
          } else {
            invariant.warn(
              `Unknown anonymous query requested in refetchQueries options.include array`
            );
          }
        }
      });
    }

    return queries;
  }

  public refetchObservableQueries(
    includeStandby: boolean = false
  ): Promise<ApolloClient.QueryResult<any>[]> {
    const observableQueryPromises: Promise<ApolloClient.QueryResult<any>>[] =
      [];

    this.getObservableQueries(includeStandby ? "all" : "active").forEach(
      (observableQuery) => {
        const { fetchPolicy } = observableQuery.options;
        if (
          (includeStandby || fetchPolicy !== "standby") &&
          fetchPolicy !== "cache-only"
        ) {
          observableQueryPromises.push(observableQuery.refetch());
        }
      }
    );

    this.broadcastQueries();

    return Promise.all(observableQueryPromises);
  }

  public startGraphQLSubscription<TData = unknown>(
    options: ApolloClient.SubscribeOptions<TData>
  ): SubscriptionObservable<ApolloClient.SubscribeResult<TData>> {
    let { query, variables } = options;
    const {
      fetchPolicy,
      errorPolicy = "none",
      context = {},
      extensions = {},
    } = options;

    checkDocument(query, OperationTypeNode.SUBSCRIPTION);

    query = this.transform(query);
    variables = this.getVariables(query, variables);

    let restart: (() => void) | undefined;

    if (__DEV__) {
      invariant(
        !this.getDocumentInfo(query).hasClientExports || this.localState,
        "Subscription '%s' contains `@client` fields with variables provided by `@export` but local state has not been configured.",
        getOperationName(query, "(anonymous)")
      );
    }

    const observable = (
      this.getDocumentInfo(query).hasClientExports ?
        from(
          this.localState!.getExportedVariables({
            client: this.client,
            document: query,
            variables,
            context,
          })
        )
      : of(variables)).pipe(
      mergeMap((variables) => {
        const { observable, restart: res } = this.getObservableFromLink<TData>(
          query,
          context,
          variables,
          extensions
        );

        const queryInfo = new QueryInfo<TData>(this);

        restart = res;
        return (observable as Observable<FormattedExecutionResult<TData>>).pipe(
          map((rawResult): ApolloClient.SubscribeResult<TData> => {
            queryInfo.markSubscriptionResult(rawResult, {
              document: query,
              variables,
              errorPolicy,
              cacheWriteBehavior:
                fetchPolicy === "no-cache" ?
                  CacheWriteBehavior.FORBID
                : CacheWriteBehavior.MERGE,
            });

            const result: ApolloClient.SubscribeResult<TData> = {
              data: rawResult.data ?? undefined,
            };

            if (graphQLResultHasError(rawResult)) {
              result.error = new CombinedGraphQLErrors(rawResult);
            } else if (graphQLResultHasProtocolErrors(rawResult)) {
              result.error = rawResult.extensions[PROTOCOL_ERRORS_SYMBOL];
              // Don't emit protocol errors added by HttpLink
              delete rawResult.extensions[PROTOCOL_ERRORS_SYMBOL];
            }

            if (
              rawResult.extensions &&
              Object.keys(rawResult.extensions).length
            ) {
              result.extensions = rawResult.extensions;
            }

            if (result.error && errorPolicy === "none") {
              result.data = undefined;
            }

            if (errorPolicy === "ignore") {
              delete result.error;
            }

            return result;
          }),
          catchError((error) => {
            if (errorPolicy === "ignore") {
              return of({
                data: undefined,
              } as ApolloClient.SubscribeResult<TData>);
            }

            return of({ data: undefined, error });
          }),
          filter((result) => !!(result.data || result.error))
        );
      })
    );

    return Object.assign(observable, { restart: () => restart?.() });
  }

  public broadcastQueries() {
    if (this.onBroadcast) this.onBroadcast();
    this.obsQueries.forEach((observableQuery) => observableQuery.notify());
  }

  // Use protected instead of private field so
  // @apollo/experimental-nextjs-app-support can access type info.
  protected inFlightLinkObservables = new Trie<{
    observable?: Observable<ApolloLink.Result<any>>;
    restart?: () => void;
  }>(false);

  private getObservableFromLink<TData = unknown>(
    query: DocumentNode,
    context: DefaultContext | undefined,
    variables?: OperationVariables,
    extensions?: Record<string, any>,
    // Prefer context.queryDeduplication if specified.
    deduplication: boolean = context?.queryDeduplication ??
      this.queryDeduplication
  ): {
    restart: () => void;
    observable: Observable<ApolloLink.Result<TData>>;
  } {
    let entry: {
      observable?: Observable<ApolloLink.Result<TData>>;
      // The restart function has to be on a mutable object that way if multiple
      // client.subscribe() calls are made before the first one subscribes to
      // the observable, the `restart` function can be updated for all
      // deduplicated client.subscribe() calls.
      restart?: () => void;
    } = {};

    const { serverQuery, clientQuery, operationType, hasIncrementalDirective } =
      this.getDocumentInfo(query);

    const operationName = getOperationName(query);
    const executeContext: ApolloLink.ExecuteContext = {
      client: this.client,
    };

    if (serverQuery) {
      const { inFlightLinkObservables, link } = this;

      try {
        const operation = this.incrementalHandler.prepareRequest({
          query: serverQuery,
          variables,
          context: {
            ...this.defaultContext,
            ...context,
            queryDeduplication: deduplication,
          },
          extensions,
        });

        context = operation.context;

        function withRestart(source: Observable<ApolloLink.Result>) {
          return new Observable<ApolloLink.Result>((observer) => {
            function subscribe() {
              return source.subscribe({
                next: observer.next.bind(observer),
                complete: observer.complete.bind(observer),
                error: observer.error.bind(observer),
              });
            }
            let subscription = subscribe();

            entry.restart ||= () => {
              subscription.unsubscribe();
              subscription = subscribe();
            };

            return () => {
              subscription.unsubscribe();
              entry.restart = undefined;
            };
          });
        }

        if (deduplication) {
          const printedServerQuery = print(serverQuery);
          const varJson = canonicalStringify(variables);

          entry = inFlightLinkObservables.lookup(printedServerQuery, varJson);

          if (!entry.observable) {
            entry.observable = execute(link, operation, executeContext).pipe(
              withRestart,
              finalize(() => {
                if (
                  inFlightLinkObservables.peek(printedServerQuery, varJson) ===
                  entry
                ) {
                  inFlightLinkObservables.remove(printedServerQuery, varJson);
                }
              }),
              // We don't want to replay the last emitted value for
              // subscriptions and instead opt to wait to receive updates until
              // the subscription emits new values.
              operationType === OperationTypeNode.SUBSCRIPTION ?
                share()
              : shareReplay({ refCount: true })
            ) as Observable<ApolloLink.Result<TData>>;
          }
        } else {
          entry.observable = execute(link, operation, executeContext).pipe(
            withRestart
          ) as Observable<ApolloLink.Result<TData>>;
        }
      } catch (error) {
        entry.observable = throwError(() => error);
      }
    } else {
      entry.observable = of({ data: {} } as ApolloLink.Result<TData>);
    }

    if (clientQuery) {
      const { operation } = getOperationDefinition(query)!;
      if (__DEV__) {
        invariant(
          this.localState,
          "%s '%s' contains `@client` fields but local state has not been configured.",
          operation[0].toUpperCase() + operation.slice(1),
          operationName ?? "(anonymous)"
        );
      }

      invariant(
        !hasIncrementalDirective,
        "%s '%s' contains `@client` and `@defer` directives. These cannot be used together.",
        operation[0].toUpperCase() + operation.slice(1),
        operationName ?? "(anonymous)"
      );

      entry.observable = entry.observable.pipe(
        mergeMap((result) => {
          return from(
            this.localState!.execute<TData>({
              client: this.client,
              document: clientQuery,
              remoteResult: result as FormattedExecutionResult<TData>,
              context,
              variables,
            })
          );
        })
      );
    }

    return {
      restart: () => entry.restart?.(),
      observable: entry.observable.pipe(
        catchError((error) => {
          error = toErrorLike(error);
          registerLinkError(error);
          throw error;
        })
      ),
    };
  }

  private getResultsFromLink<TData, TVariables extends OperationVariables>(
    options: {
      query: DocumentNode;
      variables: TVariables;
      context: DefaultContext | undefined;
      fetchPolicy: WatchQueryFetchPolicy;
      errorPolicy: ErrorPolicy;
    },
    {
      queryInfo,
      cacheWriteBehavior,
      observableQuery,
    }: {
      queryInfo: QueryInfo<TData, TVariables>;
      cacheWriteBehavior: CacheWriteBehavior;
      observableQuery: ObservableQuery<TData, TVariables> | undefined;
    }
  ): Observable<ObservableQuery.Result<TData>> {
    const requestId = (queryInfo.lastRequestId = this.generateRequestId());
    const { errorPolicy } = options;

    // Performing transformForLink here gives this.cache a chance to fill in
    // missing fragment definitions (for example) before sending this document
    // through the link chain.
    const linkDocument = this.cache.transformForLink(options.query);

    return this.getObservableFromLink<TData>(
      linkDocument,
      options.context,
      options.variables
    ).observable.pipe(
      map((incoming) => {
        // Use linkDocument rather than queryInfo.document so the
        // operation/fragments used to write the result are the same as the
        // ones used to obtain it from the link.
        const result = queryInfo.markQueryResult(incoming, {
          ...options,
          document: linkDocument,
          cacheWriteBehavior,
        });
        const hasErrors = graphQLResultHasError(result);

        if (hasErrors && errorPolicy === "none") {
          queryInfo.resetLastWrite();
          observableQuery?.["resetNotifications"]();
          throw new CombinedGraphQLErrors(result);
        }

        const aqr = {
          data: result.data as TData,
          ...(queryInfo.hasNext ?
            {
              loading: true,
              networkStatus: NetworkStatus.streaming,
              dataState: "streaming",
              partial: true,
            }
          : {
              dataState: result.data ? "complete" : "empty",
              loading: false,
              networkStatus: NetworkStatus.ready,
              partial: !result.data,
            }),
        } as ObservableQuery.Result<TData>;

        // In the case we start multiple network requests simultaneously, we
        // want to ensure we properly set `data` if we're reporting on an old
        // result which will not be caught by the conditional above that ends up
        // throwing the markError result.
        if (hasErrors) {
          if (errorPolicy === "none") {
            aqr.data = void 0 as TData;
            aqr.dataState = "empty";
          }
          if (errorPolicy !== "ignore") {
            aqr.error = new CombinedGraphQLErrors(result);
            if (aqr.dataState !== "streaming") {
              aqr.networkStatus = NetworkStatus.error;
            }
          }
        }

        return aqr;
      }),
      catchError((error) => {
        // Avoid storing errors from older interrupted queries.
        if (requestId >= queryInfo.lastRequestId && errorPolicy === "none") {
          queryInfo.resetLastWrite();
          observableQuery?.["resetNotifications"]();
          throw error;
        }

        const aqr: ObservableQuery.Result<TData> = {
          data: undefined,
          dataState: "empty",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: true,
        };

        if (errorPolicy !== "ignore") {
          aqr.error = error;
          aqr.networkStatus = NetworkStatus.error;
        }

        return of(aqr);
      })
    );
  }

  public fetchObservableWithInfo<TData, TVariables extends OperationVariables>(
    options: ApolloClient.WatchQueryOptions<TData, TVariables>,
    {
      // The initial networkStatus for this fetch, most often
      // NetworkStatus.loading, but also possibly fetchMore, poll, refetch,
      // or setVariables.
      networkStatus = NetworkStatus.loading,
      query = options.query,
      fetchQueryOperator = (x) => x,
      onCacheHit = () => {},
      observableQuery,
    }: {
      networkStatus?: NetworkStatus;
      query?: DocumentNode;
      fetchQueryOperator?: <T>(source: Observable<T>) => Observable<T>;
      onCacheHit?: () => void;
      observableQuery?: ObservableQuery<TData, TVariables> | undefined;
    }
  ): ObservableAndInfo<TData> {
    const variables = this.getVariables(query, options.variables) as TVariables;

    const defaults = this.defaultOptions.watchQuery;
    let {
      fetchPolicy = (defaults && defaults.fetchPolicy) || "cache-first",
      errorPolicy = (defaults && defaults.errorPolicy) || "none",
      returnPartialData = false,
      notifyOnNetworkStatusChange = true,
      context = {},
    } = options;

    if (
      this.prioritizeCacheValues &&
      (fetchPolicy === "network-only" || fetchPolicy === "cache-and-network")
    ) {
      fetchPolicy = "cache-first";
    }

    const normalized = Object.assign({}, options, {
      query,
      variables,
      fetchPolicy,
      errorPolicy,
      returnPartialData,
      notifyOnNetworkStatusChange,
      context,
    });

    const queryInfo = new QueryInfo<TData, TVariables>(this, observableQuery);

    const fromVariables = (variables: TVariables) => {
      // Since normalized is always a fresh copy of options, it's safe to
      // modify its properties here, rather than creating yet another new
      // WatchQueryOptions object.
      normalized.variables = variables;

      const cacheWriteBehavior =
        fetchPolicy === "no-cache" ? CacheWriteBehavior.FORBID
          // Watched queries must opt into overwriting existing data on refetch,
          // by passing refetchWritePolicy: "overwrite" in their WatchQueryOptions.
        : (
          networkStatus === NetworkStatus.refetch &&
          normalized.refetchWritePolicy !== "merge"
        ) ?
          CacheWriteBehavior.OVERWRITE
        : CacheWriteBehavior.MERGE;
      const observableWithInfo = this.fetchQueryByPolicy<TData, TVariables>(
        normalized,
        { queryInfo, cacheWriteBehavior, onCacheHit, observableQuery }
      );
      observableWithInfo.observable =
        observableWithInfo.observable.pipe(fetchQueryOperator);

      if (
        // If we're in standby, postpone advancing options.fetchPolicy using
        // applyNextFetchPolicy.
        normalized.fetchPolicy !== "standby"
      ) {
        observableQuery?.["applyNextFetchPolicy"](
          "after-fetch",
          options as any
        );
      }

      return observableWithInfo;
    };

    // This cancel function needs to be set before the concast is created,
    // in case concast creation synchronously cancels the request.
    const cleanupCancelFn = () => {
      this.fetchCancelFns.delete(queryInfo.id);
    };
    this.fetchCancelFns.set(queryInfo.id, (error) => {
      fetchCancelSubject.next({
        kind: "E",
        error,
        source: "network",
      });
    });

    const fetchCancelSubject = new Subject<QueryNotification.Value<TData>>();
    let observable: Observable<QueryNotification.Value<TData>>,
      containsDataFromLink: boolean;

    // If the query has @export(as: ...) directives, then we need to
    // process those directives asynchronously. When there are no
    // @export directives (the common case), we deliberately avoid
    // wrapping the result of this.fetchQueryByPolicy in a Promise,
    // since the timing of result delivery is (unfortunately) important
    // for backwards compatibility. TODO This code could be simpler if
    // we deprecated and removed LocalState.
    if (this.getDocumentInfo(normalized.query).hasClientExports) {
      if (__DEV__) {
        invariant(
          this.localState,
          "Query '%s' contains `@client` fields with variables provided by `@export` but local state has not been configured.",
          getOperationName(normalized.query, "(anonymous)")
        );
      }

      observable = from(
        this.localState!.getExportedVariables({
          client: this.client,
          document: normalized.query,
          variables: normalized.variables,
          context: normalized.context,
        })
      ).pipe(mergeMap((variables) => fromVariables(variables).observable));

      // there is just no way we can synchronously get the *right* value here,
      // so we will assume `true`, which is the behaviour before the bug fix in
      // #10597. This means that bug is not fixed in that case, and is probably
      // un-fixable with reasonable effort for the edge case of @export as
      // directives.
      containsDataFromLink = true;
    } else {
      const sourcesWithInfo = fromVariables(normalized.variables);
      containsDataFromLink = sourcesWithInfo.fromLink;
      observable = sourcesWithInfo.observable;
    }

    return {
      // Merge `observable` with `fetchCancelSubject`, in a way that completing or
      // erroring either of them will complete the merged obserable.
      observable: new Observable<QueryNotification.Value<TData>>((observer) => {
        observer.add(cleanupCancelFn);
        observable.subscribe(observer);
        fetchCancelSubject.subscribe(observer);
      }).pipe(share()),
      fromLink: containsDataFromLink,
    };
  }

  public refetchQueries<TResult>({
    updateCache,
    include,
    optimistic = false,
    removeOptimistic = optimistic ? makeUniqueId("refetchQueries") : void 0,
    onQueryUpdated,
  }: InternalRefetchQueriesOptions<
    ApolloCache,
    TResult
  >): InternalRefetchQueriesMap<TResult> {
    const includedQueriesByOq = new Map<
      ObservableQuery<any>,
      {
        oq: ObservableQuery<any>;
        lastDiff?: Cache.DiffResult<any>;
        diff?: Cache.DiffResult<any>;
      }
    >();

    if (include) {
      this.getObservableQueries(include).forEach((oq) => {
        if (oq.options.fetchPolicy === "cache-only") {
          return;
        }

        const current = oq.getCurrentResult();
        includedQueriesByOq.set(oq, {
          oq,
          lastDiff: {
            result: current?.data,
            complete: !current?.partial,
          },
        });
      });
    }

    const results: InternalRefetchQueriesMap<TResult> = new Map();

    if (updateCache) {
      const handled = new Set<ObservableQuery<any>>();
      this.cache.batch({
        update: updateCache,

        // Since you can perform any combination of cache reads and/or writes in
        // the cache.batch update function, its optimistic option can be either
        // a boolean or a string, representing three distinct modes of
        // operation:
        //
        // * false: read/write only the root layer
        // * true: read/write the topmost layer
        // * string: read/write a fresh optimistic layer with that ID string
        //
        // When typeof optimistic === "string", a new optimistic layer will be
        // temporarily created within cache.batch with that string as its ID. If
        // we then pass that same string as the removeOptimistic option, we can
        // make cache.batch immediately remove the optimistic layer after
        // running the updateCache function, triggering only one broadcast.
        //
        // However, the refetchQueries method accepts only true or false for its
        // optimistic option (not string). We interpret true to mean a temporary
        // optimistic layer should be created, to allow efficiently rolling back
        // the effect of the updateCache function, which involves passing a
        // string instead of true as the optimistic option to cache.batch, when
        // refetchQueries receives optimistic: true.
        //
        // In other words, we are deliberately not supporting the use case of
        // writing to an *existing* optimistic layer (using the refetchQueries
        // updateCache function), since that would potentially interfere with
        // other optimistic updates in progress. Instead, you can read/write
        // only the root layer by passing optimistic: false to refetchQueries,
        // or you can read/write a brand new optimistic layer that will be
        // automatically removed by passing optimistic: true.
        optimistic: (optimistic && removeOptimistic) || false,

        // The removeOptimistic option can also be provided by itself, even if
        // optimistic === false, to remove some previously-added optimistic
        // layer safely and efficiently, like we do in markMutationResult.
        //
        // If an explicit removeOptimistic string is provided with optimistic:
        // true, the removeOptimistic string will determine the ID of the
        // temporary optimistic layer, in case that ever matters.
        removeOptimistic,

        onWatchUpdated(watch, diff, lastDiff) {
          const oq = watch.watcher;

          if (oq instanceof ObservableQuery && !handled.has(oq)) {
            handled.add(oq);
            if (onQueryUpdated) {
              // Since we're about to handle this query now, remove it from
              // includedQueriesById, in case it was added earlier because of
              // options.include.
              includedQueriesByOq.delete(oq);

              let result:
                | TResult
                | boolean
                | Promise<ApolloClient.QueryResult<any>> = onQueryUpdated(
                oq,
                diff,
                lastDiff
              );

              if (result === true) {
                // The onQueryUpdated function requested the default refetching
                // behavior by returning true.
                result = oq
                  .refetch()
                  .retain(/* create a persistent subscription on the query */);
              }

              // Record the result in the results Map, as long as onQueryUpdated
              // did not return false to skip/ignore this result.
              if (result !== false) {
                results.set(
                  oq,
                  result as InternalRefetchQueriesResult<TResult>
                );
              }

              // Allow the default cache broadcast to happen, except when
              // onQueryUpdated returns false.
              return result;
            }

            if (
              onQueryUpdated !== null &&
              oq.options.fetchPolicy !== "cache-only"
            ) {
              // If we don't have an onQueryUpdated function, and onQueryUpdated
              // was not disabled by passing null, make sure this query is
              // "included" like any other options.include-specified query.
              includedQueriesByOq.set(oq, { oq, lastDiff, diff });
            }
          }
        },
      });
    }

    if (includedQueriesByOq.size) {
      includedQueriesByOq.forEach(({ oq, lastDiff, diff }) => {
        let result:
          | TResult
          | boolean
          | Promise<ApolloClient.QueryResult<any>>
          | undefined;

        // If onQueryUpdated is provided, we want to use it for all included
        // queries, even the QueryOptions ones.
        if (onQueryUpdated) {
          if (!diff) {
            diff = oq.getCacheDiff();
          }
          result = onQueryUpdated(oq, diff, lastDiff);
        }

        // Otherwise, we fall back to refetching.
        if (!onQueryUpdated || result === true) {
          result = oq
            .refetch()
            .retain(/* create a persistent subscription on the query */);
        }

        if (result !== false) {
          results.set(oq, result as InternalRefetchQueriesResult<TResult>);
        }
      });
    }

    if (removeOptimistic) {
      // In case no updateCache callback was provided (so cache.batch was not
      // called above, and thus did not already remove the optimistic layer),
      // remove it here. Since this is a no-op when the layer has already been
      // removed, we do it even if we called cache.batch above, since it's
      // possible this.cache is an instance of some ApolloCache subclass other
      // than InMemoryCache, and does not fully support the removeOptimistic
      // option for cache.batch.
      this.cache.removeOptimistic(removeOptimistic);
    }

    return results;
  }

  private noCacheWarningsByCause = new WeakSet<object>();

  public maskOperation<TData = unknown>(
    options: MaskOperationOptions<TData>
  ): MaybeMasked<TData> {
    const { document, data } = options;

    if (__DEV__) {
      const { fetchPolicy, cause = {} } = options;
      const operationType = getOperationDefinition(document)?.operation;

      if (
        this.dataMasking &&
        fetchPolicy === "no-cache" &&
        !isFullyUnmaskedOperation(document) &&
        !this.noCacheWarningsByCause.has(cause)
      ) {
        this.noCacheWarningsByCause.add(cause);

        invariant.warn(
          '[%s]: Fragments masked by data masking are inaccessible when using fetch policy "no-cache". Please add `@unmask` to each fragment spread to access the data.',
          getOperationName(document, `Unnamed ${operationType ?? "operation"}`)
        );
      }
    }

    return (
      this.dataMasking ?
        maskOperation(data, document, this.cache)
      : data) as MaybeMasked<TData>;
  }

  public maskFragment<TData = unknown>(options: MaskFragmentOptions<TData>) {
    const { data, fragment, fragmentName } = options;

    return this.dataMasking ?
        maskFragment(data, fragment, this.cache, fragmentName)
      : data;
  }

  private fetchQueryByPolicy<TData, TVariables extends OperationVariables>(
    {
      query,
      variables,
      fetchPolicy,
      errorPolicy,
      returnPartialData,
      context,
    }: {
      query: DocumentNode | TypedDocumentNode<TData, TVariables>;
      variables: TVariables;
      fetchPolicy: WatchQueryFetchPolicy;
      errorPolicy: ErrorPolicy;
      returnPartialData?: boolean;
      context?: DefaultContext;
    },
    {
      cacheWriteBehavior,
      onCacheHit,
      queryInfo,
      observableQuery,
    }: {
      cacheWriteBehavior: CacheWriteBehavior;
      onCacheHit: () => void;
      queryInfo: QueryInfo<TData, TVariables>;
      observableQuery: ObservableQuery<TData, TVariables> | undefined;
    }
  ): ObservableAndInfo<TData> {
    const readCache = () =>
      this.cache.diff<any>({
        query,
        variables,
        returnPartialData: true,
        optimistic: true,
      });

    const resultsFromCache = (
      diff: Cache.DiffResult<TData>,
      networkStatus: NetworkStatus
    ): Observable<QueryNotification.FromCache<TData>> => {
      const data = diff.result;

      if (__DEV__ && !returnPartialData && data !== null) {
        logMissingFieldErrors(diff.missing);
      }

      const toResult = (
        data: TData | DeepPartial<TData> | undefined
      ): ObservableQuery.Result<TData> => {
        // TODO: Eventually we should move this handling into
        // queryInfo.getDiff() directly. Since getDiff is updated to return null
        // on returnPartialData: false, we should take advantage of that instead
        // of having to patch it elsewhere.
        if (!diff.complete && !returnPartialData) {
          data = undefined;
        }

        return {
          // TODO: Handle partial data
          data: data as TData | undefined,
          dataState:
            diff.complete ? "complete"
            : data ? "partial"
            : "empty",
          loading: isNetworkRequestInFlight(networkStatus),
          networkStatus,
          partial: !diff.complete,
        } as ObservableQuery.Result<TData>;
      };

      const fromData = (
        data: TData | DeepPartial<TData> | undefined
      ): Observable<QueryNotification.FromCache<TData>> => {
        return of({
          kind: "N",
          value: toResult(data),
          source: "cache",
        });
      };

      if (
        // Don't attempt to run forced resolvers if we have incomplete cache
        // data and partial isn't allowed since this result would get set to
        // `undefined` anyways in `toResult`.
        (diff.complete || returnPartialData) &&
        this.getDocumentInfo(query).hasForcedResolvers
      ) {
        if (__DEV__) {
          invariant(
            this.localState,
            "Query '%s' contains `@client` fields but local state has not been configured.",
            getOperationName(query, "(anonymous)")
          );
        }
        onCacheHit();

        return from(
          this.localState!.execute<TData>({
            client: this.client,
            document: query,
            remoteResult: data ? { data } : undefined,
            context,
            variables,
            onlyRunForcedResolvers: true,
            returnPartialData: true,
          }).then(
            (resolved): QueryNotification.FromCache<TData> => ({
              kind: "N",
              value: toResult(resolved.data || void 0),
              source: "cache",
            })
          )
        );
      }

      // Resolves https://github.com/apollographql/apollo-client/issues/10317.
      // If errorPolicy is 'none' and notifyOnNetworkStatusChange is true,
      // data was incorrectly returned from the cache on refetch:
      // if diff.missing exists, we should not return cache data.
      if (
        errorPolicy === "none" &&
        networkStatus === NetworkStatus.refetch &&
        diff.missing
      ) {
        return fromData(void 0);
      }

      return fromData(data || undefined);
    };

    const resultsFromLink = () =>
      this.getResultsFromLink<TData, TVariables>(
        {
          query,
          variables,
          context,
          fetchPolicy,
          errorPolicy,
        },
        {
          cacheWriteBehavior,
          queryInfo,
          observableQuery,
        }
      ).pipe(
        validateDidEmitValue(),
        materialize(),
        map(
          (result): QueryNotification.FromNetwork<TData> => ({
            ...result,
            source: "network",
          })
        )
      );

    switch (fetchPolicy) {
      default:
      case "cache-first": {
        const diff = readCache();

        if (diff.complete) {
          return {
            fromLink: false,
            observable: resultsFromCache(diff, NetworkStatus.ready),
          };
        }

        if (returnPartialData) {
          return {
            fromLink: true,
            observable: concat(
              resultsFromCache(diff, NetworkStatus.loading),
              resultsFromLink()
            ),
          };
        }

        return { fromLink: true, observable: resultsFromLink() };
      }

      case "cache-and-network": {
        const diff = readCache();

        if (diff.complete || returnPartialData) {
          return {
            fromLink: true,
            observable: concat(
              resultsFromCache(diff, NetworkStatus.loading),
              resultsFromLink()
            ),
          };
        }

        return { fromLink: true, observable: resultsFromLink() };
      }

      case "cache-only":
        return {
          fromLink: false,
          observable: concat(
            resultsFromCache(readCache(), NetworkStatus.ready)
          ),
        };

      case "network-only":
        return { fromLink: true, observable: resultsFromLink() };

      case "no-cache":
        return { fromLink: true, observable: resultsFromLink() };

      case "standby":
        return { fromLink: false, observable: EMPTY };
    }
  }
}

function validateDidEmitValue<T>() {
  let didEmitValue = false;

  return tap<T>({
    next() {
      didEmitValue = true;
    },
    complete() {
      invariant(
        didEmitValue,
        "The link chain completed without emitting a value. This is likely unintentional and should be updated to emit a value before completing."
      );
    },
  });
}

// Return types used by fetchQueryByPolicy and other private methods above.
interface ObservableAndInfo<TData> {
  // Metadata properties that can be returned in addition to the Observable.
  fromLink: boolean;
  observable: Observable<QueryNotification.Value<TData>>;
}

function isFullyUnmaskedOperation(document: DocumentNode) {
  let isUnmasked = true;

  visit(document, {
    FragmentSpread: (node) => {
      isUnmasked =
        !!node.directives &&
        node.directives.some((directive) => directive.name.value === "unmask");

      if (!isUnmasked) {
        return BREAK;
      }
    },
  });

  return isUnmasked;
}

function addNonReactiveToNamedFragments(document: DocumentNode) {
  return visit(document, {
    FragmentSpread: (node) => {
      // Do not add `@nonreactive` if the fragment is marked with `@unmask`
      // since we want to react to changes in this fragment.
      if (
        node.directives?.some((directive) => directive.name.value === "unmask")
      ) {
        return;
      }

      return {
        ...node,
        directives: [
          ...(node.directives || []),
          {
            kind: Kind.DIRECTIVE,
            name: { kind: Kind.NAME, value: "nonreactive" },
          } satisfies DirectiveNode,
        ],
      };
    },
  });
}
