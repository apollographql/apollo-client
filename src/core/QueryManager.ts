import { Trie } from "@wry/trie";
import type { DirectiveNode, DocumentNode } from "graphql";
import { BREAK, Kind, OperationTypeNode, visit } from "graphql";
import type { Subscription } from "rxjs";
import {
  catchError,
  concat,
  EMPTY,
  filter,
  from,
  lastValueFrom,
  map,
  materialize,
  mergeMap,
  Observable,
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
import type {
  ExecuteContext,
  FetchResult,
  GraphQLRequest,
} from "@apollo/client/link";
import { execute } from "@apollo/client/link";
import type { LocalState } from "@apollo/client/local-state";
import type { MaybeMasked, Unmasked } from "@apollo/client/masking";
import { maskFragment, maskOperation } from "@apollo/client/masking";
import type { DeepPartial } from "@apollo/client/utilities";
import { cacheSizes, DocumentTransform, print } from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import {
  AutoCleanedWeakCache,
  checkDocument,
  filterMap,
  getDefaultValues,
  getGraphQLErrorsFromResult,
  getOperationDefinition,
  getOperationName,
  graphQLResultHasError,
  hasDirectives,
  hasForcedResolvers,
  isDocumentNode,
  isExecutionPatchIncrementalResult,
  isExecutionPatchResult,
  isNonEmptyArray,
  isNonNullObject,
  makeUniqueId,
  mergeIncrementalData,
  onAnyEvent,
  removeDirectivesFromDocument,
  toQueryResult,
} from "@apollo/client/utilities/internal";
import {
  invariant,
  newInvariantError,
} from "@apollo/client/utilities/invariant";

import type { IgnoreModifier } from "../cache/core/types/common.js";
import { defaultCacheSizes } from "../utilities/caching/sizes.js";

import type { ApolloClient, DefaultOptions } from "./ApolloClient.js";
import { isNetworkRequestInFlight, NetworkStatus } from "./networkStatus.js";
import { logMissingFieldErrors, ObservableQuery } from "./ObservableQuery.js";
import {
  CacheWriteBehavior,
  QueryInfo,
  shouldWriteResult,
} from "./QueryInfo.js";
import type {
  ApolloQueryResult,
  ClientAwareness,
  DefaultContext,
  InternalRefetchQueriesInclude,
  InternalRefetchQueriesMap,
  InternalRefetchQueriesOptions,
  InternalRefetchQueriesResult,
  MutateResult,
  MutationUpdaterFunction,
  OnQueryUpdated,
  OperationVariables,
  QueryNotification,
  QueryResult,
  SubscribeResult,
  TypedDocumentNode,
} from "./types.js";
import type {
  ErrorPolicy,
  MutationFetchPolicy,
  MutationOptions,
  QueryOptions,
  SubscriptionOptions,
  WatchQueryFetchPolicy,
  WatchQueryOptions,
} from "./watchQueryOptions.js";

const { hasOwnProperty } = Object.prototype;

const IGNORE = {} as IgnoreModifier;

interface MutationStoreValue {
  mutation: DocumentNode;
  variables: Record<string, any>;
  loading: boolean;
  error: Error | null;
}

type UpdateQueries<TData> = MutationOptions<TData, any, any>["updateQueries"];

interface TransformCacheEntry {
  hasClientExports: boolean;
  hasForcedResolvers: boolean;
  hasNonreactiveDirective: boolean;
  nonReactiveQuery: DocumentNode;
  clientQuery: DocumentNode | null;
  serverQuery: DocumentNode | null;
  defaultVars: OperationVariables;
  asQuery: DocumentNode;
}

interface MaskFragmentOptions<TData> {
  fragment: DocumentNode;
  data: TData;
  fragmentName?: string;
}

interface MaskOperationOptions<TData> {
  document: DocumentNode;
  data: TData;
  id: string;
  fetchPolicy?: WatchQueryFetchPolicy;
}

interface QueryManagerOptions {
  client: ApolloClient;
  defaultOptions: DefaultOptions;
  documentTransform: DocumentTransform | null | undefined;
  queryDeduplication: boolean;
  onBroadcast: undefined | (() => void);
  ssrMode: boolean;
  clientAwareness: ClientAwareness;
  assumeImmutableResults: boolean;
  defaultContext: Partial<DefaultContext> | undefined;
  dataMasking: boolean;
  localState: LocalState | undefined;
}

export class QueryManager {
  public defaultOptions: DefaultOptions;

  public readonly client: ApolloClient;
  public readonly assumeImmutableResults: boolean;
  public readonly documentTransform: DocumentTransform;
  public readonly ssrMode: boolean;
  public readonly defaultContext: Partial<DefaultContext>;
  public readonly dataMasking: boolean;
  public localState: LocalState | undefined;

  private queryDeduplication: boolean;
  private clientAwareness: ClientAwareness = {};

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

  // Maps from queryId strings to Promise rejection functions for
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
    this.clientAwareness = options.clientAwareness;
    this.ssrMode = options.ssrMode;
    this.assumeImmutableResults = options.assumeImmutableResults;
    this.dataMasking = options.dataMasking;
    this.localState = options.localState;
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
    fetchPolicy = this.defaultOptions.mutate?.fetchPolicy || "network-only",
    errorPolicy = this.defaultOptions.mutate?.errorPolicy || "none",
    keepRootFields,
    context,
  }: MutationOptions<TData, TVariables, TCache>): Promise<
    MutateResult<MaybeMasked<TData>>
  > {
    invariant(
      mutation,
      "mutation option is required. You must specify your GraphQL document in the mutation option."
    );

    checkDocument(mutation, OperationTypeNode.MUTATION);

    invariant(
      fetchPolicy === "network-only" || fetchPolicy === "no-cache",
      "Mutations support only 'network-only' or 'no-cache' fetchPolicy strings. The default `network-only` behavior automatically writes mutation results to the cache. Passing `no-cache` skips the cache write."
    );

    const mutationId = this.generateMutationId();

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
      (this.mutationStore[mutationId] = {
        mutation,
        variables,
        loading: true,
        error: null,
      } as MutationStoreValue);

    const isOptimistic =
      optimisticResponse &&
      this.markMutationOptimistic<TData, TVariables, TCache>(
        optimisticResponse,
        {
          mutationId,
          document: mutation,
          variables,
          fetchPolicy,
          errorPolicy,
          context,
          updateQueries,
          update: updateWithProxyFn,
          keepRootFields,
        }
      );

    this.broadcastQueries();

    return new Promise((resolve, reject) => {
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
        .pipe(
          validateDidEmitValue(),
          mergeMap((result) => {
            const hasErrors = graphQLResultHasError(result);
            if (hasErrors && errorPolicy === "none") {
              throw new CombinedGraphQLErrors(result);
            }

            if (mutationStoreValue) {
              mutationStoreValue.loading = false;
              mutationStoreValue.error = null;
            }

            const storeResult: typeof result = { ...result };

            if (typeof refetchQueries === "function") {
              refetchQueries = refetchQueries(
                storeResult as FetchResult<Unmasked<TData>>
              );
            }

            if (errorPolicy === "ignore" && hasErrors) {
              delete storeResult.errors;
            }

            return from(
              this.markMutationResult<TData, TVariables, TCache>({
                mutationId,
                result: storeResult,
                document: mutation,
                variables,
                fetchPolicy,
                errorPolicy,
                context,
                update: updateWithProxyFn,
                updateQueries,
                awaitRefetchQueries,
                refetchQueries,
                removeOptimistic: isOptimistic ? mutationId : void 0,
                onQueryUpdated,
                keepRootFields,
              })
            );
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
            if (!("hasNext" in storeResult) || storeResult.hasNext === false) {
              const result: MutateResult<TData> = {
                data: this.maskOperation({
                  document: mutation,
                  data: storeResult.data,
                  fetchPolicy,
                  id: mutationId,
                }) as any,
              };

              if (graphQLResultHasError(storeResult)) {
                result.error = new CombinedGraphQLErrors(storeResult);
              }

              if (storeResult.extensions) {
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
              this.cache.removeOptimistic(mutationId);
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

  public markMutationResult<
    TData,
    TVariables extends OperationVariables,
    TCache extends ApolloCache,
  >(
    mutation: {
      mutationId: string;
      result: FetchResult<TData>;
      document: DocumentNode;
      variables?: TVariables;
      fetchPolicy?: MutationFetchPolicy;
      errorPolicy: ErrorPolicy;
      context?: DefaultContext;
      updateQueries: UpdateQueries<TData>;
      update?: MutationUpdaterFunction<TData, TVariables, TCache>;
      awaitRefetchQueries?: boolean;
      refetchQueries?: InternalRefetchQueriesInclude;
      removeOptimistic?: string;
      onQueryUpdated?: OnQueryUpdated<any>;
      keepRootFields?: boolean;
    },
    cache = this.cache
  ): Promise<FetchResult<TData>> {
    let { result } = mutation;
    const cacheWrites: Cache.WriteOptions[] = [];
    const skipCache = mutation.fetchPolicy === "no-cache";

    if (!skipCache && shouldWriteResult(result, mutation.errorPolicy)) {
      if (!isExecutionPatchIncrementalResult(result)) {
        cacheWrites.push({
          result: result.data,
          dataId: "ROOT_MUTATION",
          query: mutation.document,
          variables: mutation.variables,
        });
      }
      if (
        isExecutionPatchIncrementalResult(result) &&
        isNonEmptyArray(result.incremental)
      ) {
        const diff = cache.diff<TData>({
          id: "ROOT_MUTATION",
          // The cache complains if passed a mutation where it expects a
          // query, so we transform mutations and subscriptions to queries
          // (only once, thanks to this.transformCache).
          query: this.getDocumentInfo(mutation.document).asQuery,
          variables: mutation.variables,
          optimistic: false,
          returnPartialData: true,
        });
        let mergedData;
        if (diff.result) {
          mergedData = mergeIncrementalData(diff.result, result);
        }
        if (typeof mergedData !== "undefined") {
          // cast the ExecutionPatchResult to FetchResult here since
          // ExecutionPatchResult never has `data` when returned from the server
          (result as FetchResult).data = mergedData;
          cacheWrites.push({
            result: mergedData,
            dataId: "ROOT_MUTATION",
            query: mutation.document,
            variables: mutation.variables,
          });
        }
      }

      const { updateQueries } = mutation;
      if (updateQueries) {
        this.obsQueries.forEach((observableQuery) => {
          const queryName = observableQuery && observableQuery.queryName;
          if (!queryName || !hasOwnProperty.call(updateQueries, queryName)) {
            return;
          }
          const updater = updateQueries[queryName];
          const { query: document, variables } = observableQuery;

          // Read the current query result from the store.
          const { result: currentQueryResult, complete } =
            observableQuery.getCacheDiff({ optimistic: false });

          if (complete && currentQueryResult) {
            // Run our reducer using the current query result and the mutation result.
            const nextQueryResult = updater(currentQueryResult, {
              mutationResult: result as FetchResult<Unmasked<TData>>,
              queryName: (document && getOperationName(document)) || void 0,
              queryVariables: variables!,
            });

            // Write the modified result back into the store if we got a new result.
            if (nextQueryResult) {
              cacheWrites.push({
                result: nextQueryResult,
                dataId: "ROOT_QUERY",
                query: document!,
                variables,
              });
            }
          }
        });
      }
    }

    if (
      cacheWrites.length > 0 ||
      (mutation.refetchQueries || "").length > 0 ||
      mutation.update ||
      mutation.onQueryUpdated ||
      mutation.removeOptimistic
    ) {
      const results: any[] = [];

      this.refetchQueries({
        updateCache: (cache) => {
          if (!skipCache) {
            cacheWrites.forEach((write) => cache.write(write));
          }

          // If the mutation has some writes associated with it then we need to
          // apply those writes to the store by running this reducer again with
          // a write action.
          const { update } = mutation;
          // Determine whether result is a SingleExecutionResult,
          // or the final ExecutionPatchResult.
          const isFinalResult =
            !isExecutionPatchResult(result) ||
            (isExecutionPatchIncrementalResult(result) && !result.hasNext);

          if (update) {
            if (!skipCache) {
              // Re-read the ROOT_MUTATION data we just wrote into the cache
              // (the first cache.write call in the cacheWrites.forEach loop
              // above), so field read functions have a chance to run for
              // fields within mutation result objects.
              const diff = cache.diff<TData>({
                id: "ROOT_MUTATION",
                // The cache complains if passed a mutation where it expects a
                // query, so we transform mutations and subscriptions to queries
                // (only once, thanks to this.transformCache).
                query: this.getDocumentInfo(mutation.document).asQuery,
                variables: mutation.variables,
                optimistic: false,
                returnPartialData: true,
              });

              if (diff.complete) {
                result = { ...(result as FetchResult), data: diff.result };
                if ("incremental" in result) {
                  delete result.incremental;
                }
                if ("hasNext" in result) {
                  delete result.hasNext;
                }
              }
            }

            // If we've received the whole response,
            // either a SingleExecutionResult or the final ExecutionPatchResult,
            // call the update function.
            if (isFinalResult) {
              update(cache as TCache, result as FetchResult<Unmasked<TData>>, {
                context: mutation.context,
                variables: mutation.variables,
              });
            }
          }

          // TODO Do this with cache.evict({ id: 'ROOT_MUTATION' }) but make it
          // shallow to allow rolling back optimistic evictions.
          if (!skipCache && !mutation.keepRootFields && isFinalResult) {
            cache.modify({
              id: "ROOT_MUTATION",
              fields(value, { fieldName, DELETE }) {
                return fieldName === "__typename" ? value : DELETE;
              },
            });
          }
        },

        include: mutation.refetchQueries,

        // Write the final mutation.result to the root layer of the cache.
        optimistic: false,

        // Remove the corresponding optimistic layer at the same time as we
        // write the final non-optimistic result.
        removeOptimistic: mutation.removeOptimistic,

        // Let the caller of client.mutate optionally determine the refetching
        // behavior for watched queries after the mutation.update function runs.
        // If no onQueryUpdated function was provided for this mutation, pass
        // null instead of undefined to disable the default refetching behavior.
        onQueryUpdated: mutation.onQueryUpdated || null,
      }).forEach((result) => results.push(result));

      if (mutation.awaitRefetchQueries || mutation.onQueryUpdated) {
        // Returning a promise here makes the mutation await that promise, so we
        // include results in that promise's work if awaitRefetchQueries or an
        // onQueryUpdated function was specified.
        return Promise.all(results).then(() => result);
      }
    }

    return Promise.resolve(result);
  }

  public markMutationOptimistic<
    TData,
    TVariables extends OperationVariables,
    TCache extends ApolloCache,
  >(
    optimisticResponse: any,
    mutation: {
      mutationId: string;
      document: DocumentNode;
      variables?: TVariables;
      fetchPolicy?: MutationFetchPolicy;
      errorPolicy: ErrorPolicy;
      context?: DefaultContext;
      updateQueries: UpdateQueries<TData>;
      update?: MutationUpdaterFunction<TData, TVariables, TCache>;
      keepRootFields?: boolean;
    }
  ) {
    const data =
      typeof optimisticResponse === "function" ?
        optimisticResponse(mutation.variables, { IGNORE })
      : optimisticResponse;

    if (data === IGNORE) {
      return false;
    }

    this.cache.recordOptimisticTransaction((cache) => {
      try {
        this.markMutationResult<TData, TVariables, TCache>(
          {
            ...mutation,
            result: { data },
          },
          cache
        );
      } catch (error) {
        invariant.error(error);
      }
    }, mutation.mutationId);

    return true;
  }

  public fetchQuery<TData, TVars extends OperationVariables>(
    options: WatchQueryOptions<TVars, TData>,
    networkStatus?: NetworkStatus
  ): Promise<QueryResult<TData>> {
    const queryInfo = new QueryInfo({
      queryManager: this,
    });
    return lastValueFrom(
      this.fetchObservableWithInfo(queryInfo, options, {
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
    );
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
      const cacheEntry: TransformCacheEntry = {
        // TODO These three calls (hasClientExports, shouldForceResolvers, and
        // usesNonreactiveDirective) are performing independent full traversals
        // of the transformed document. We should consider merging these
        // traversals into a single pass in the future, though the work is
        // cached after the first time.
        hasClientExports: hasDirectives(["client", "export"], document, true),
        hasForcedResolvers: hasForcedResolvers(document),
        hasNonreactiveDirective: hasDirectives(["nonreactive"], document),
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
        defaultVars: getDefaultValues(
          getOperationDefinition(document)
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

    return transformCache.get(document)!;
  }

  public getVariables<TVariables>(
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
    T,
    TVariables extends OperationVariables = OperationVariables,
  >(options: WatchQueryOptions<TVariables, T>): ObservableQuery<T, TVariables> {
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

    const observable = new ObservableQuery<T, TVariables>({
      queryManager: this,
      options,
      transformedQuery: query,
    });

    return observable;
  }

  public async query<
    TData,
    TVars extends OperationVariables = OperationVariables,
  >(
    options: QueryOptions<TVars, TData>,
    queryId = this.generateQueryId()
  ): Promise<QueryResult<MaybeMasked<TData>>> {
    const query = this.transform(options.query);

    return this.fetchQuery<TData, TVars>({
      ...(options as any),
      query,
    }).then((value) => ({
      ...value,
      data: this.maskOperation({
        document: query,
        data: value?.data,
        fetchPolicy: options.fetchPolicy,
        id: queryId,
      }),
    }));
  }

  private queryIdCounter = 1;
  public generateQueryId() {
    return String(this.queryIdCounter++);
  }

  private requestIdCounter = 1;
  public generateRequestId() {
    return this.requestIdCounter++;
  }

  private mutationIdCounter = 1;
  public generateMutationId() {
    return String(this.mutationIdCounter++);
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
    const queries = new Map<string, ObservableQuery<any>>();
    const queryNames = new Map<string, string | undefined>();
    const queryNamesAndQueryStrings = new Map<string, boolean>();
    const legacyQueryOptions = new Set<QueryOptions>();

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
      const queryId = oq.queryId;
      const document = oq["lastQuery"] || oq.options.query;
      if (include === "all") {
        queries.set(queryId, oq);
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
        (document && queryNamesAndQueryStrings.has(print(document)))
      ) {
        queries.set(queryId, oq);
        if (queryName) queryNamesAndQueryStrings.set(queryName, true);
        if (document) queryNamesAndQueryStrings.set(print(document), true);
      }
    });

    if (legacyQueryOptions.size) {
      legacyQueryOptions.forEach((options: QueryOptions) => {
        const oq = new ObservableQuery({
          queryManager: this,
          options: {
            ...options,
            fetchPolicy: "network-only",
          },
        });
        queries.set(oq.queryId, oq);
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
  ): Promise<QueryResult<any>[]> {
    const observableQueryPromises: Promise<QueryResult<any>>[] = [];

    this.getObservableQueries(includeStandby ? "all" : "active").forEach(
      (observableQuery, queryId) => {
        const { fetchPolicy } = observableQuery.options;
        if (
          includeStandby ||
          (fetchPolicy !== "standby" && fetchPolicy !== "cache-only")
        ) {
          observableQueryPromises.push(observableQuery.refetch());
        }
      }
    );

    this.broadcastQueries();

    return Promise.all(observableQueryPromises);
  }

  public startGraphQLSubscription<TData = unknown>(
    options: SubscriptionOptions
  ): Observable<SubscribeResult<TData>> {
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

    const makeObservable = (variables: OperationVariables) =>
      this.getObservableFromLink<TData>(
        query,
        context,
        variables,
        extensions
      ).pipe(
        map((rawResult): SubscribeResult<TData> => {
          if (fetchPolicy !== "no-cache") {
            // the subscription interface should handle not sending us results we no longer subscribe to.
            // XXX I don't think we ever send in an object with errors, but we might in the future...
            if (shouldWriteResult(rawResult, errorPolicy)) {
              this.cache.write({
                query,
                result: rawResult.data,
                dataId: "ROOT_SUBSCRIPTION",
                variables: variables,
              });
            }

            this.broadcastQueries();
          }

          const result: SubscribeResult<TData> = {
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
            return of({ data: undefined } as SubscribeResult<TData>);
          }

          return of({ data: undefined, error });
        }),
        filter((result) => !!(result.data || result.error))
      );

    if (this.getDocumentInfo(query).hasClientExports) {
      if (__DEV__) {
        invariant(
          this.localState,
          "Subscription '%s' contains `@client` fields with variables provided by `@export` but local state has not been configured.",
          getOperationName(query, "(anonymous)")
        );
      }

      const observablePromise = this.localState!.getExportedVariables({
        client: this.client,
        document: query,
        variables,
        context,
      }).then(makeObservable);

      return new Observable<SubscribeResult<TData>>((observer) => {
        let sub: Subscription | null = null;
        observablePromise.then(
          (observable) => (sub = observable.subscribe(observer)),
          observer.error
        );
        return () => sub && sub.unsubscribe();
      });
    }

    return makeObservable(variables);
  }

  public broadcastQueries() {
    if (this.onBroadcast) this.onBroadcast();
    this.obsQueries.forEach((observableQuery) => observableQuery.notify());
  }

  // Use protected instead of private field so
  // @apollo/experimental-nextjs-app-support can access type info.
  protected inFlightLinkObservables = new Trie<{
    observable?: Observable<FetchResult<any>>;
  }>(false);

  private getObservableFromLink<TData = unknown>(
    query: DocumentNode,
    context: DefaultContext | undefined,
    variables?: OperationVariables,
    extensions?: Record<string, any>,
    // Prefer context.queryDeduplication if specified.
    deduplication: boolean = context?.queryDeduplication ??
      this.queryDeduplication
  ): Observable<FetchResult<TData>> {
    let observable: Observable<FetchResult<TData>> | undefined;

    const { serverQuery, clientQuery } = this.getDocumentInfo(query);

    const operationName = getOperationName(query);
    const executeContext: ExecuteContext = {
      client: this.client,
    };

    if (serverQuery) {
      const { inFlightLinkObservables, link } = this;

      const operation: GraphQLRequest = {
        query: serverQuery,
        variables,
        operationName,
        context: {
          ...this.defaultContext,
          ...context,
          queryDeduplication: deduplication,
          clientAwareness: this.clientAwareness,
        },
        extensions,
      };

      context = operation.context;

      if (deduplication) {
        const printedServerQuery = print(serverQuery);
        const varJson = canonicalStringify(variables);

        const entry = inFlightLinkObservables.lookup(
          printedServerQuery,
          varJson
        );

        observable = entry.observable;
        if (!observable) {
          observable = entry.observable = execute(
            link,
            operation,
            executeContext
          ).pipe(
            onAnyEvent((event) => {
              if (
                (event.type !== "next" ||
                  !("hasNext" in event.value) ||
                  !event.value.hasNext) &&
                inFlightLinkObservables.peek(printedServerQuery, varJson) ===
                  entry
              ) {
                inFlightLinkObservables.remove(printedServerQuery, varJson);
              }
            }),
            shareReplay({ refCount: true })
          );
        }
      } else {
        observable = execute(link, operation, executeContext) as Observable<
          FetchResult<TData>
        >;
      }
    } else {
      observable = of({ data: {} } as FetchResult<TData>);
    }

    if (clientQuery) {
      if (__DEV__) {
        const { operation } = getOperationDefinition(query)!;

        invariant(
          this.localState,
          "%s '%s' contains `@client` fields but local state has not been configured.",
          operation[0].toUpperCase() + operation.slice(1),
          operationName ?? "(anonymous)"
        );
      }

      observable = observable.pipe(
        mergeMap((result) => {
          return from(
            this.localState!.execute<TData>({
              client: this.client,
              document: clientQuery,
              remoteResult: result,
              context,
              variables,
            })
          );
        })
      );
    }

    return observable.pipe(
      catchError((error) => {
        error = toErrorLike(error);
        registerLinkError(error);
        throw error;
      })
    );
  }

  private getResultsFromLink<TData, TVariables extends OperationVariables>(
    queryInfo: QueryInfo,
    cacheWriteBehavior: CacheWriteBehavior,
    options: {
      query: DocumentNode;
      variables: TVariables;
      context: DefaultContext | undefined;
      fetchPolicy: WatchQueryFetchPolicy;
      errorPolicy: ErrorPolicy;
    }
  ): Observable<ApolloQueryResult<TData>> {
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
    ).pipe(
      map((result) => {
        const graphQLErrors = getGraphQLErrorsFromResult(result);
        const hasErrors = graphQLErrors.length > 0;

        // If we interrupted this request by calling getResultsFromLink again
        // with the same QueryInfo object, we ignore the old results.
        if (requestId >= queryInfo.lastRequestId) {
          if (hasErrors && errorPolicy === "none") {
            queryInfo.resetLastWrite();
            queryInfo.observableQuery?.["resetNotifications"]();
            // Throwing here effectively calls observer.error.
            throw new CombinedGraphQLErrors(result);
          }
          // Use linkDocument rather than queryInfo.document so the
          // operation/fragments used to write the result are the same as the
          // ones used to obtain it from the link.
          queryInfo.markResult(
            result,
            linkDocument,
            options,
            cacheWriteBehavior
          );
        }

        const aqr: ApolloQueryResult<TData> = {
          data: result.data as TData,
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: !result.data,
        };

        // In the case we start multiple network requests simulatenously, we
        // want to ensure we properly set `data` if we're reporting on an old
        // result which will not be caught by the conditional above that ends up
        // throwing the markError result.
        if (hasErrors && errorPolicy === "none") {
          aqr.data = void 0 as TData;
        }

        if (hasErrors && errorPolicy !== "ignore") {
          aqr.error = new CombinedGraphQLErrors(result);
          aqr.networkStatus = NetworkStatus.error;
        }

        return aqr;
      }),
      catchError((error) => {
        // Avoid storing errors from older interrupted queries.
        if (requestId >= queryInfo.lastRequestId && errorPolicy === "none") {
          queryInfo.resetLastWrite();
          queryInfo.observableQuery?.["resetNotifications"]();
          throw error;
        }

        const aqr: ApolloQueryResult<TData> = {
          data: undefined,
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

  public fetchObservableWithInfo<TData, TVars extends OperationVariables>(
    queryInfo: QueryInfo,
    options: WatchQueryOptions<TVars, TData>,
    {
      // The initial networkStatus for this fetch, most often
      // NetworkStatus.loading, but also possibly fetchMore, poll, refetch,
      // or setVariables.
      networkStatus = NetworkStatus.loading,
      query = options.query,
      fetchQueryOperator = (x) => x,
      onCacheHit = () => {},
    }: {
      networkStatus?: NetworkStatus;
      query?: DocumentNode;
      fetchQueryOperator?: <T>(source: Observable<T>) => Observable<T>;
      onCacheHit?: () => void;
    }
  ): ObservableAndInfo<TData> {
    const variables = this.getVariables(query, options.variables) as TVars;

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

    const fromVariables = (variables: TVars) => {
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
      const observableWithInfo = this.fetchQueryByPolicy<TData, TVars>(
        queryInfo,
        normalized,
        cacheWriteBehavior,
        onCacheHit
      );
      observableWithInfo.observable =
        observableWithInfo.observable.pipe(fetchQueryOperator);

      if (
        // If we're in standby, postpone advancing options.fetchPolicy using
        // applyNextFetchPolicy.
        normalized.fetchPolicy !== "standby" &&
        queryInfo.observableQuery
      ) {
        queryInfo.observableQuery["applyNextFetchPolicy"](
          "after-fetch",
          options as any
        );
      }

      return observableWithInfo;
    };

    // This cancel function needs to be set before the concast is created,
    // in case concast creation synchronously cancels the request.
    const cleanupCancelFn = () => {
      this.fetchCancelFns.delete(queryInfo.queryId);
      // We need to call `complete` on the subject here otherwise the merged
      // observable will never complete since it waits for all source
      // observables to complete before itself completes.
    };
    this.fetchCancelFns.set(queryInfo.queryId, (error) => {
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
      //
      observable: new Observable<QueryNotification.Value<TData>>((observer) => {
        observer.add(cleanupCancelFn);
        observer.add(observable.subscribe(observer));
        observer.add(fetchCancelSubject.subscribe(observer));
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
    const includedQueriesById = new Map<
      string,
      {
        oq: ObservableQuery<any>;
        lastDiff?: Cache.DiffResult<any>;
        diff?: Cache.DiffResult<any>;
      }
    >();

    if (include) {
      this.getObservableQueries(include).forEach((oq, queryId) => {
        const current = oq.getCurrentResult();
        includedQueriesById.set(queryId, {
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

          if (oq instanceof ObservableQuery) {
            if (onQueryUpdated && !handled.has(oq)) {
              handled.add(oq);
              // Since we're about to handle this query now, remove it from
              // includedQueriesById, in case it was added earlier because of
              // options.include.
              includedQueriesById.delete(oq.queryId);

              let result: TResult | boolean | Promise<QueryResult<any>> =
                onQueryUpdated(oq, diff, lastDiff);

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

            if (onQueryUpdated !== null) {
              // If we don't have an onQueryUpdated function, and onQueryUpdated
              // was not disabled by passing null, make sure this query is
              // "included" like any other options.include-specified query.
              includedQueriesById.set(oq.queryId, { oq, lastDiff, diff });
            }
          }
        },
      });
    }

    if (includedQueriesById.size) {
      includedQueriesById.forEach(({ oq, lastDiff, diff }, queryId) => {
        let result: TResult | boolean | Promise<QueryResult<any>> | undefined;

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

  private noCacheWarningsByQueryId = new Set<string>();

  public maskOperation<TData = unknown>(
    options: MaskOperationOptions<TData>
  ): MaybeMasked<TData> {
    const { document, data } = options;

    if (__DEV__) {
      const { fetchPolicy, id } = options;
      const operationType = getOperationDefinition(document)?.operation;
      const operationId = (operationType?.[0] ?? "o") + id;

      if (
        this.dataMasking &&
        fetchPolicy === "no-cache" &&
        !isFullyUnmaskedOperation(document) &&
        !this.noCacheWarningsByQueryId.has(operationId)
      ) {
        this.noCacheWarningsByQueryId.add(operationId);

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

  private fetchQueryByPolicy<TData, TVars extends OperationVariables>(
    queryInfo: QueryInfo,
    {
      query,
      variables,
      fetchPolicy,
      errorPolicy,
      returnPartialData,
      context,
    }: {
      query: DocumentNode | TypedDocumentNode<TData, TVars>;
      variables: TVars;
      fetchPolicy: WatchQueryFetchPolicy;
      errorPolicy: ErrorPolicy;
      returnPartialData?: boolean;
      context?: DefaultContext;
    },
    cacheWriteBehavior: CacheWriteBehavior,
    onCacheHit: () => void
  ): ObservableAndInfo<TData> {
    queryInfo.init({
      document: query,
      variables,
    });
    const readCache = () => this.cache.diff<any>(queryInfo.getDiffOptions());

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
      ): ApolloQueryResult<TData> => {
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
          loading: isNetworkRequestInFlight(networkStatus),
          networkStatus,
          partial: !diff.complete,
        };
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
      this.getResultsFromLink<TData, TVars>(queryInfo, cacheWriteBehavior, {
        query,
        variables,
        context,
        fetchPolicy,
        errorPolicy,
      }).pipe(
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
  checkDocument(document);

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
