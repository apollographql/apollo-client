import { invariant, newInvariantError } from "../utilities/globals/index.js";

import type { DocumentNode } from "graphql";
// TODO(brian): A hack until this issue is resolved (https://github.com/graphql/graphql-js/issues/3356)
type OperationTypeNode = any;
import { equal } from "@wry/equality";

import type { ApolloLink, FetchResult } from "../link/core/index.js";
import { execute } from "../link/core/index.js";
import {
  defaultCacheSizes,
  hasDirectives,
  isExecutionPatchIncrementalResult,
  isExecutionPatchResult,
  removeDirectivesFromDocument,
} from "../utilities/index.js";
import type { Cache, ApolloCache } from "../cache/index.js";
import { canonicalStringify } from "../cache/index.js";

import type {
  ObservableSubscription,
  ConcastSourcesArray,
} from "../utilities/index.js";
import {
  getDefaultValues,
  getOperationDefinition,
  getOperationName,
  hasClientExports,
  graphQLResultHasError,
  getGraphQLErrorsFromResult,
  Observable,
  asyncMap,
  isNonEmptyArray,
  Concast,
  makeUniqueId,
  isDocumentNode,
  isNonNullObject,
  DocumentTransform,
} from "../utilities/index.js";
import { mergeIncrementalData } from "../utilities/common/incrementalResult.js";
import {
  ApolloError,
  isApolloError,
  graphQLResultHasProtocolErrors,
} from "../errors/index.js";
import type {
  QueryOptions,
  WatchQueryOptions,
  SubscriptionOptions,
  MutationOptions,
  ErrorPolicy,
  MutationFetchPolicy,
} from "./watchQueryOptions.js";
import { ObservableQuery, logMissingFieldErrors } from "./ObservableQuery.js";
import { NetworkStatus, isNetworkRequestInFlight } from "./networkStatus.js";
import type {
  ApolloQueryResult,
  OperationVariables,
  MutationUpdaterFunction,
  OnQueryUpdated,
  InternalRefetchQueriesInclude,
  InternalRefetchQueriesOptions,
  InternalRefetchQueriesResult,
  InternalRefetchQueriesMap,
  DefaultContext,
} from "./types.js";
import { LocalState } from "./LocalState.js";

import type { QueryStoreValue } from "./QueryInfo.js";
import {
  QueryInfo,
  shouldWriteResult,
  CacheWriteBehavior,
} from "./QueryInfo.js";
import type { ApolloErrorOptions } from "../errors/index.js";
import { PROTOCOL_ERRORS_SYMBOL } from "../errors/index.js";
import { print } from "../utilities/index.js";
import type { IgnoreModifier } from "../cache/core/types/common.js";
import type { TODO } from "../utilities/types/TODO.js";

const { hasOwnProperty } = Object.prototype;

const IGNORE: IgnoreModifier = Object.create(null);

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
  clientQuery: DocumentNode | null;
  serverQuery: DocumentNode | null;
  defaultVars: OperationVariables;
  asQuery: DocumentNode;
}

import type { DefaultOptions } from "./ApolloClient.js";
import { Trie } from "@wry/trie";
import { AutoCleanedWeakCache, cacheSizes } from "../utilities/index.js";

export class QueryManager<TStore> {
  public cache: ApolloCache<TStore>;
  public link: ApolloLink;
  public defaultOptions: DefaultOptions;

  public readonly assumeImmutableResults: boolean;
  public readonly documentTransform: DocumentTransform;
  public readonly ssrMode: boolean;
  public readonly defaultContext: Partial<DefaultContext>;

  private queryDeduplication: boolean;
  private clientAwareness: Record<string, string> = {};
  private localState: LocalState<TStore>;

  private onBroadcast?: () => void;
  public mutationStore?: {
    [mutationId: string]: MutationStoreValue;
  };

  // All the queries that the QueryManager is currently managing (not
  // including mutations and subscriptions).
  private queries = new Map<string, QueryInfo>();

  // Maps from queryId strings to Promise rejection functions for
  // currently active queries and fetches.
  // Use protected instead of private field so
  // @apollo/experimental-nextjs-app-support can access type info.
  protected fetchCancelFns = new Map<string, (error: any) => any>();

  constructor({
    cache,
    link,
    defaultOptions,
    documentTransform,
    queryDeduplication = false,
    onBroadcast,
    ssrMode = false,
    clientAwareness = {},
    localState,
    assumeImmutableResults = !!cache.assumeImmutableResults,
    defaultContext,
  }: {
    cache: ApolloCache<TStore>;
    link: ApolloLink;
    defaultOptions?: DefaultOptions;
    documentTransform?: DocumentTransform;
    queryDeduplication?: boolean;
    onBroadcast?: () => void;
    ssrMode?: boolean;
    clientAwareness?: Record<string, string>;
    localState?: LocalState<TStore>;
    assumeImmutableResults?: boolean;
    defaultContext?: Partial<DefaultContext>;
  }) {
    const defaultDocumentTransform = new DocumentTransform(
      (document) => this.cache.transformDocument(document),
      // Allow the apollo cache to manage its own transform caches
      { cache: false }
    );

    this.cache = cache;
    this.link = link;
    this.defaultOptions = defaultOptions || Object.create(null);
    this.queryDeduplication = queryDeduplication;
    this.clientAwareness = clientAwareness;
    this.localState = localState || new LocalState({ cache });
    this.ssrMode = ssrMode;
    this.assumeImmutableResults = assumeImmutableResults;
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
    this.defaultContext = defaultContext || Object.create(null);

    if ((this.onBroadcast = onBroadcast)) {
      this.mutationStore = Object.create(null);
    }
  }

  /**
   * Call this method to terminate any active query processes, making it safe
   * to dispose of this QueryManager instance.
   */
  public stop() {
    this.queries.forEach((_info, queryId) => {
      this.stopQueryNoBroadcast(queryId);
    });

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
    TContext extends Record<string, any>,
    TCache extends ApolloCache<any>,
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
  }: MutationOptions<TData, TVariables, TContext>): Promise<
    FetchResult<TData>
  > {
    invariant(
      mutation,
      "mutation option is required. You must specify your GraphQL document in the mutation option."
    );

    invariant(
      fetchPolicy === "network-only" || fetchPolicy === "no-cache",
      "Mutations support only 'network-only' or 'no-cache' fetchPolicy strings. The default `network-only` behavior automatically writes mutation results to the cache. Passing `no-cache` skips the cache write."
    );

    const mutationId = this.generateMutationId();

    mutation = this.cache.transformForLink(this.transform(mutation));
    const { hasClientExports } = this.getDocumentInfo(mutation);

    variables = this.getVariables(mutation, variables) as TVariables;
    if (hasClientExports) {
      variables = (await this.localState.addExportedVariables(
        mutation,
        variables,
        context
      )) as TVariables;
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
      this.markMutationOptimistic<TData, TVariables, TContext, TCache>(
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

    const self = this;

    return new Promise((resolve, reject) => {
      return asyncMap(
        self.getObservableFromLink(
          mutation,
          {
            ...context,
            optimisticResponse: isOptimistic ? optimisticResponse : void 0,
          },
          variables,
          false
        ),

        (result: FetchResult<TData>) => {
          if (graphQLResultHasError(result) && errorPolicy === "none") {
            throw new ApolloError({
              graphQLErrors: getGraphQLErrorsFromResult(result),
            });
          }

          if (mutationStoreValue) {
            mutationStoreValue.loading = false;
            mutationStoreValue.error = null;
          }

          const storeResult: typeof result = { ...result };

          if (typeof refetchQueries === "function") {
            refetchQueries = refetchQueries(storeResult);
          }

          if (errorPolicy === "ignore" && graphQLResultHasError(storeResult)) {
            delete storeResult.errors;
          }

          return self.markMutationResult<TData, TVariables, TContext, TCache>({
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
          });
        }
      ).subscribe({
        next(storeResult) {
          self.broadcastQueries();

          // Since mutations might receive multiple payloads from the
          // ApolloLink chain (e.g. when used with @defer),
          // we resolve with a SingleExecutionResult or after the final
          // ExecutionPatchResult has arrived and we have assembled the
          // multipart response into a single result.
          if (!("hasNext" in storeResult) || storeResult.hasNext === false) {
            resolve(storeResult);
          }
        },

        error(err: Error) {
          if (mutationStoreValue) {
            mutationStoreValue.loading = false;
            mutationStoreValue.error = err;
          }

          if (isOptimistic) {
            self.cache.removeOptimistic(mutationId);
          }

          self.broadcastQueries();

          reject(
            err instanceof ApolloError ? err : (
              new ApolloError({
                networkError: err,
              })
            )
          );
        },
      });
    });
  }

  public markMutationResult<
    TData,
    TVariables,
    TContext,
    TCache extends ApolloCache<any>,
  >(
    mutation: {
      mutationId: string;
      result: FetchResult<TData>;
      document: DocumentNode;
      variables?: TVariables;
      fetchPolicy?: MutationFetchPolicy;
      errorPolicy: ErrorPolicy;
      context?: TContext;
      updateQueries: UpdateQueries<TData>;
      update?: MutationUpdaterFunction<TData, TVariables, TContext, TCache>;
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
        this.queries.forEach(({ observableQuery }, queryId) => {
          const queryName = observableQuery && observableQuery.queryName;
          if (!queryName || !hasOwnProperty.call(updateQueries, queryName)) {
            return;
          }
          const updater = updateQueries[queryName];
          const { document, variables } = this.queries.get(queryId)!;

          // Read the current query result from the store.
          const { result: currentQueryResult, complete } = cache.diff<TData>({
            query: document!,
            variables,
            returnPartialData: true,
            optimistic: false,
          });

          if (complete && currentQueryResult) {
            // Run our reducer using the current query result and the mutation result.
            const nextQueryResult = updater(currentQueryResult, {
              mutationResult: result,
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
              update(cache as TCache, result, {
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
    TVariables,
    TContext,
    TCache extends ApolloCache<any>,
  >(
    optimisticResponse: any,
    mutation: {
      mutationId: string;
      document: DocumentNode;
      variables?: TVariables;
      fetchPolicy?: MutationFetchPolicy;
      errorPolicy: ErrorPolicy;
      context?: TContext;
      updateQueries: UpdateQueries<TData>;
      update?: MutationUpdaterFunction<TData, TVariables, TContext, TCache>;
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
        this.markMutationResult<TData, TVariables, TContext, TCache>(
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
    queryId: string,
    options: WatchQueryOptions<TVars, TData>,
    networkStatus?: NetworkStatus
  ): Promise<ApolloQueryResult<TData>> {
    return this.fetchConcastWithInfo(queryId, options, networkStatus).concast
      .promise as TODO;
  }

  public getQueryStore() {
    const store: Record<string, QueryStoreValue> = Object.create(null);
    this.queries.forEach((info, queryId) => {
      store[queryId] = {
        variables: info.variables,
        networkStatus: info.networkStatus,
        networkError: info.networkError,
        graphQLErrors: info.graphQLErrors,
      };
    });
    return store;
  }

  public resetErrors(queryId: string) {
    const queryInfo = this.queries.get(queryId);
    if (queryInfo) {
      queryInfo.networkError = undefined;
      queryInfo.graphQLErrors = [];
    }
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
        hasClientExports: hasClientExports(document),
        hasForcedResolvers: this.localState.shouldForceResolvers(document),
        hasNonreactiveDirective: hasDirectives(["nonreactive"], document),
        clientQuery: this.localState.clientQuery(document),
        serverQuery: removeDirectivesFromDocument(
          [
            { name: "client", remove: true },
            { name: "connection" },
            { name: "nonreactive" },
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

  private getVariables<TVariables>(
    document: DocumentNode,
    variables?: TVariables
  ): OperationVariables {
    return {
      ...this.getDocumentInfo(document).defaultVars,
      ...variables,
    };
  }

  public watchQuery<
    T,
    TVariables extends OperationVariables = OperationVariables,
  >(options: WatchQueryOptions<TVariables, T>): ObservableQuery<T, TVariables> {
    const query = this.transform(options.query);

    // assign variable default values if supplied
    // NOTE: We don't modify options.query here with the transformed query to
    // ensure observable.options.query is set to the raw untransformed query.
    options = {
      ...options,
      variables: this.getVariables(query, options.variables) as TVariables,
    };

    if (typeof options.notifyOnNetworkStatusChange === "undefined") {
      options.notifyOnNetworkStatusChange = false;
    }

    const queryInfo = new QueryInfo(this);
    const observable = new ObservableQuery<T, TVariables>({
      queryManager: this,
      queryInfo,
      options,
    });
    observable["lastQuery"] = query;

    this.queries.set(observable.queryId, queryInfo);

    // We give queryInfo the transformed query to ensure the first cache diff
    // uses the transformed query instead of the raw query
    queryInfo.init({
      document: query,
      observableQuery: observable,
      variables: observable.variables,
    });

    return observable;
  }

  public query<TData, TVars extends OperationVariables = OperationVariables>(
    options: QueryOptions<TVars, TData>,
    queryId = this.generateQueryId()
  ): Promise<ApolloQueryResult<TData>> {
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

    return this.fetchQuery<TData, TVars>(queryId, {
      ...options,
      query: this.transform(options.query),
    }).finally(() => this.stopQuery(queryId));
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

  public stopQueryInStore(queryId: string) {
    this.stopQueryInStoreNoBroadcast(queryId);
    this.broadcastQueries();
  }

  private stopQueryInStoreNoBroadcast(queryId: string) {
    const queryInfo = this.queries.get(queryId);
    if (queryInfo) queryInfo.stop();
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

    this.queries.forEach((queryInfo) => {
      if (queryInfo.observableQuery) {
        // Set loading to true so listeners don't trigger unless they want
        // results with partial data.
        queryInfo.networkStatus = NetworkStatus.loading;
      } else {
        queryInfo.stop();
      }
    });

    if (this.mutationStore) {
      this.mutationStore = Object.create(null);
    }

    // begin removing data from the store
    return this.cache.reset(options);
  }

  public getObservableQueries(
    include: InternalRefetchQueriesInclude = "active"
  ) {
    const queries = new Map<string, ObservableQuery<any>>();
    const queryNamesAndDocs = new Map<string | DocumentNode, boolean>();
    const legacyQueryOptions = new Set<QueryOptions>();

    if (Array.isArray(include)) {
      include.forEach((desc) => {
        if (typeof desc === "string") {
          queryNamesAndDocs.set(desc, false);
        } else if (isDocumentNode(desc)) {
          queryNamesAndDocs.set(this.transform(desc), false);
        } else if (isNonNullObject(desc) && desc.query) {
          legacyQueryOptions.add(desc);
        }
      });
    }

    this.queries.forEach(({ observableQuery: oq, document }, queryId) => {
      if (oq) {
        if (include === "all") {
          queries.set(queryId, oq);
          return;
        }

        const {
          queryName,
          options: { fetchPolicy },
        } = oq;

        if (
          fetchPolicy === "standby" ||
          (include === "active" && !oq.hasObservers())
        ) {
          return;
        }

        if (
          include === "active" ||
          (queryName && queryNamesAndDocs.has(queryName)) ||
          (document && queryNamesAndDocs.has(document))
        ) {
          queries.set(queryId, oq);
          if (queryName) queryNamesAndDocs.set(queryName, true);
          if (document) queryNamesAndDocs.set(document, true);
        }
      }
    });

    if (legacyQueryOptions.size) {
      legacyQueryOptions.forEach((options: QueryOptions) => {
        // We will be issuing a fresh network request for this query, so we
        // pre-allocate a new query ID here, using a special prefix to enable
        // cleaning up these temporary queries later, after fetching.
        const queryId = makeUniqueId("legacyOneTimeQuery");
        const queryInfo = this.getQuery(queryId).init({
          document: options.query,
          variables: options.variables,
        });
        const oq = new ObservableQuery({
          queryManager: this,
          queryInfo,
          options: {
            ...options,
            fetchPolicy: "network-only",
          },
        });
        invariant(oq.queryId === queryId);
        queryInfo.setObservableQuery(oq);
        queries.set(queryId, oq);
      });
    }

    if (__DEV__ && queryNamesAndDocs.size) {
      queryNamesAndDocs.forEach((included, nameOrDoc) => {
        if (!included) {
          invariant.warn(
            typeof nameOrDoc === "string" ?
              `Unknown query named "%s" requested in refetchQueries options.include array`
            : `Unknown query %o requested in refetchQueries options.include array`,
            nameOrDoc
          );
        }
      });
    }

    return queries;
  }

  public reFetchObservableQueries(
    includeStandby: boolean = false
  ): Promise<ApolloQueryResult<any>[]> {
    const observableQueryPromises: Promise<ApolloQueryResult<any>>[] = [];

    this.getObservableQueries(includeStandby ? "all" : "active").forEach(
      (observableQuery, queryId) => {
        const { fetchPolicy } = observableQuery.options;
        observableQuery.resetLastResults();
        if (
          includeStandby ||
          (fetchPolicy !== "standby" && fetchPolicy !== "cache-only")
        ) {
          observableQueryPromises.push(observableQuery.refetch());
        }
        this.getQuery(queryId).setDiff(null);
      }
    );

    this.broadcastQueries();

    return Promise.all(observableQueryPromises);
  }

  public setObservableQuery(observableQuery: ObservableQuery<any, any>) {
    this.getQuery(observableQuery.queryId).setObservableQuery(observableQuery);
  }

  public startGraphQLSubscription<T = any>({
    query,
    fetchPolicy,
    errorPolicy = "none",
    variables,
    context = {},
  }: SubscriptionOptions): Observable<FetchResult<T>> {
    query = this.transform(query);
    variables = this.getVariables(query, variables);

    const makeObservable = (variables: OperationVariables) =>
      this.getObservableFromLink<T>(query, context, variables).map((result) => {
        if (fetchPolicy !== "no-cache") {
          // the subscription interface should handle not sending us results we no longer subscribe to.
          // XXX I don't think we ever send in an object with errors, but we might in the future...
          if (shouldWriteResult(result, errorPolicy)) {
            this.cache.write({
              query,
              result: result.data,
              dataId: "ROOT_SUBSCRIPTION",
              variables: variables,
            });
          }

          this.broadcastQueries();
        }

        const hasErrors = graphQLResultHasError(result);
        const hasProtocolErrors = graphQLResultHasProtocolErrors(result);
        if (hasErrors || hasProtocolErrors) {
          const errors: ApolloErrorOptions = {};
          if (hasErrors) {
            errors.graphQLErrors = result.errors;
          }
          if (hasProtocolErrors) {
            errors.protocolErrors = result.extensions[PROTOCOL_ERRORS_SYMBOL];
          }

          // `errorPolicy` is a mechanism for handling GraphQL errors, according
          // to our documentation, so we throw protocol errors regardless of the
          // set error policy.
          if (errorPolicy === "none" || hasProtocolErrors) {
            throw new ApolloError(errors);
          }
        }

        if (errorPolicy === "ignore") {
          delete result.errors;
        }

        return result;
      });

    if (this.getDocumentInfo(query).hasClientExports) {
      const observablePromise = this.localState
        .addExportedVariables(query, variables, context)
        .then(makeObservable);

      return new Observable<FetchResult<T>>((observer) => {
        let sub: ObservableSubscription | null = null;
        observablePromise.then(
          (observable) => (sub = observable.subscribe(observer)),
          observer.error
        );
        return () => sub && sub.unsubscribe();
      });
    }

    return makeObservable(variables);
  }

  public stopQuery(queryId: string) {
    this.stopQueryNoBroadcast(queryId);
    this.broadcastQueries();
  }

  private stopQueryNoBroadcast(queryId: string) {
    this.stopQueryInStoreNoBroadcast(queryId);
    this.removeQuery(queryId);
  }

  public removeQuery(queryId: string) {
    // teardown all links
    // Both `QueryManager.fetchRequest` and `QueryManager.query` create separate promises
    // that each add their reject functions to fetchCancelFns.
    // A query created with `QueryManager.query()` could trigger a `QueryManager.fetchRequest`.
    // The same queryId could have two rejection fns for two promises
    this.fetchCancelFns.delete(queryId);
    if (this.queries.has(queryId)) {
      this.getQuery(queryId).stop();
      this.queries.delete(queryId);
    }
  }

  public broadcastQueries() {
    if (this.onBroadcast) this.onBroadcast();
    this.queries.forEach((info) => info.notify());
  }

  public getLocalState(): LocalState<TStore> {
    return this.localState;
  }

  // Use protected instead of private field so
  // @apollo/experimental-nextjs-app-support can access type info.
  protected inFlightLinkObservables = new Trie<{
    observable?: Observable<FetchResult<any>>;
  }>(false);

  private getObservableFromLink<T = any>(
    query: DocumentNode,
    context: any,
    variables?: OperationVariables,
    // Prefer context.queryDeduplication if specified.
    deduplication: boolean = context?.queryDeduplication ??
      this.queryDeduplication
  ): Observable<FetchResult<T>> {
    let observable: Observable<FetchResult<T>> | undefined;

    const { serverQuery, clientQuery } = this.getDocumentInfo(query);
    if (serverQuery) {
      const { inFlightLinkObservables, link } = this;

      const operation = {
        query: serverQuery,
        variables,
        operationName: getOperationName(serverQuery) || void 0,
        context: this.prepareContext({
          ...context,
          forceFetch: !deduplication,
        }),
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
          const concast = new Concast([
            execute(link, operation) as Observable<FetchResult<T>>,
          ]);
          observable = entry.observable = concast;

          concast.beforeNext(() => {
            inFlightLinkObservables.remove(printedServerQuery, varJson);
          });
        }
      } else {
        observable = new Concast([
          execute(link, operation) as Observable<FetchResult<T>>,
        ]);
      }
    } else {
      observable = new Concast([Observable.of({ data: {} } as FetchResult<T>)]);
      context = this.prepareContext(context);
    }

    if (clientQuery) {
      observable = asyncMap(observable, (result) => {
        return this.localState.runResolvers({
          document: clientQuery,
          remoteResult: result,
          context,
          variables,
        });
      });
    }

    return observable;
  }

  private getResultsFromLink<TData, TVars extends OperationVariables>(
    queryInfo: QueryInfo,
    cacheWriteBehavior: CacheWriteBehavior,
    options: Pick<
      WatchQueryOptions<TVars, TData>,
      "query" | "variables" | "context" | "fetchPolicy" | "errorPolicy"
    >
  ): Observable<ApolloQueryResult<TData>> {
    const requestId = (queryInfo.lastRequestId = this.generateRequestId());

    // Performing transformForLink here gives this.cache a chance to fill in
    // missing fragment definitions (for example) before sending this document
    // through the link chain.
    const linkDocument = this.cache.transformForLink(options.query);

    return asyncMap(
      this.getObservableFromLink(
        linkDocument,
        options.context,
        options.variables
      ),

      (result) => {
        const graphQLErrors = getGraphQLErrorsFromResult(result);
        const hasErrors = graphQLErrors.length > 0;

        // If we interrupted this request by calling getResultsFromLink again
        // with the same QueryInfo object, we ignore the old results.
        if (requestId >= queryInfo.lastRequestId) {
          if (hasErrors && options.errorPolicy === "none") {
            // Throwing here effectively calls observer.error.
            throw queryInfo.markError(
              new ApolloError({
                graphQLErrors,
              })
            );
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
          queryInfo.markReady();
        }

        const aqr: ApolloQueryResult<TData> = {
          data: result.data,
          loading: false,
          networkStatus: NetworkStatus.ready,
        };

        if (hasErrors && options.errorPolicy !== "ignore") {
          aqr.errors = graphQLErrors;
          aqr.networkStatus = NetworkStatus.error;
        }

        return aqr;
      },

      (networkError) => {
        const error =
          isApolloError(networkError) ? networkError : (
            new ApolloError({ networkError })
          );

        // Avoid storing errors from older interrupted queries.
        if (requestId >= queryInfo.lastRequestId) {
          queryInfo.markError(error);
        }

        throw error;
      }
    );
  }

  private fetchConcastWithInfo<TData, TVars extends OperationVariables>(
    queryId: string,
    options: WatchQueryOptions<TVars, TData>,
    // The initial networkStatus for this fetch, most often
    // NetworkStatus.loading, but also possibly fetchMore, poll, refetch,
    // or setVariables.
    networkStatus = NetworkStatus.loading,
    query = options.query
  ): ConcastAndInfo<TData> {
    const variables = this.getVariables(query, options.variables) as TVars;
    const queryInfo = this.getQuery(queryId);

    const defaults = this.defaultOptions.watchQuery;
    let {
      fetchPolicy = (defaults && defaults.fetchPolicy) || "cache-first",
      errorPolicy = (defaults && defaults.errorPolicy) || "none",
      returnPartialData = false,
      notifyOnNetworkStatusChange = false,
      context = {},
    } = options;

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

      const sourcesWithInfo = this.fetchQueryByPolicy<TData, TVars>(
        queryInfo,
        normalized,
        networkStatus
      );

      if (
        // If we're in standby, postpone advancing options.fetchPolicy using
        // applyNextFetchPolicy.
        normalized.fetchPolicy !== "standby" &&
        // The "standby" policy currently returns [] from fetchQueryByPolicy, so
        // this is another way to detect when nothing was done/fetched.
        sourcesWithInfo.sources.length > 0 &&
        queryInfo.observableQuery
      ) {
        queryInfo.observableQuery["applyNextFetchPolicy"](
          "after-fetch",
          options
        );
      }

      return sourcesWithInfo;
    };

    // This cancel function needs to be set before the concast is created,
    // in case concast creation synchronously cancels the request.
    const cleanupCancelFn = () => this.fetchCancelFns.delete(queryId);
    this.fetchCancelFns.set(queryId, (reason) => {
      cleanupCancelFn();
      // This delay ensures the concast variable has been initialized.
      setTimeout(() => concast.cancel(reason));
    });

    let concast: Concast<ApolloQueryResult<TData>>,
      containsDataFromLink: boolean;
    // If the query has @export(as: ...) directives, then we need to
    // process those directives asynchronously. When there are no
    // @export directives (the common case), we deliberately avoid
    // wrapping the result of this.fetchQueryByPolicy in a Promise,
    // since the timing of result delivery is (unfortunately) important
    // for backwards compatibility. TODO This code could be simpler if
    // we deprecated and removed LocalState.
    if (this.getDocumentInfo(normalized.query).hasClientExports) {
      concast = new Concast(
        this.localState
          .addExportedVariables(
            normalized.query,
            normalized.variables,
            normalized.context
          )
          .then(fromVariables)
          .then((sourcesWithInfo) => sourcesWithInfo.sources)
      );
      // there is just no way we can synchronously get the *right* value here,
      // so we will assume `true`, which is the behaviour before the bug fix in
      // #10597. This means that bug is not fixed in that case, and is probably
      // un-fixable with reasonable effort for the edge case of @export as
      // directives.
      containsDataFromLink = true;
    } else {
      const sourcesWithInfo = fromVariables(normalized.variables);
      containsDataFromLink = sourcesWithInfo.fromLink;
      concast = new Concast(sourcesWithInfo.sources);
    }

    concast.promise.then(cleanupCancelFn, cleanupCancelFn);

    return {
      concast,
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
    ApolloCache<TStore>,
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
        includedQueriesById.set(queryId, {
          oq,
          lastDiff: this.getQuery(queryId).getDiff(),
        });
      });
    }

    const results: InternalRefetchQueriesMap<TResult> = new Map();

    if (updateCache) {
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
          const oq =
            watch.watcher instanceof QueryInfo && watch.watcher.observableQuery;

          if (oq) {
            if (onQueryUpdated) {
              // Since we're about to handle this query now, remove it from
              // includedQueriesById, in case it was added earlier because of
              // options.include.
              includedQueriesById.delete(oq.queryId);

              let result: TResult | boolean | Promise<ApolloQueryResult<any>> =
                onQueryUpdated(oq, diff, lastDiff);

              if (result === true) {
                // The onQueryUpdated function requested the default refetching
                // behavior by returning true.
                result = oq.refetch();
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
        let result:
          | TResult
          | boolean
          | Promise<ApolloQueryResult<any>>
          | undefined;

        // If onQueryUpdated is provided, we want to use it for all included
        // queries, even the QueryOptions ones.
        if (onQueryUpdated) {
          if (!diff) {
            const info = oq["queryInfo"];
            info.reset(); // Force info.getDiff() to read from cache.
            diff = info.getDiff();
          }
          result = onQueryUpdated(oq, diff, lastDiff);
        }

        // Otherwise, we fall back to refetching.
        if (!onQueryUpdated || result === true) {
          result = oq.refetch();
        }

        if (result !== false) {
          results.set(oq, result as InternalRefetchQueriesResult<TResult>);
        }

        if (queryId.indexOf("legacyOneTimeQuery") >= 0) {
          this.stopQueryNoBroadcast(queryId);
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

  private fetchQueryByPolicy<TData, TVars extends OperationVariables>(
    queryInfo: QueryInfo,
    {
      query,
      variables,
      fetchPolicy,
      refetchWritePolicy,
      errorPolicy,
      returnPartialData,
      context,
      notifyOnNetworkStatusChange,
    }: WatchQueryOptions<TVars, TData>,
    // The initial networkStatus for this fetch, most often
    // NetworkStatus.loading, but also possibly fetchMore, poll, refetch,
    // or setVariables.
    networkStatus: NetworkStatus
  ): SourcesAndInfo<TData> {
    const oldNetworkStatus = queryInfo.networkStatus;

    queryInfo.init({
      document: query,
      variables,
      networkStatus,
    });

    const readCache = () => queryInfo.getDiff();

    const resultsFromCache = (
      diff: Cache.DiffResult<TData>,
      networkStatus = queryInfo.networkStatus || NetworkStatus.loading
    ) => {
      const data = diff.result;

      if (__DEV__ && !returnPartialData && !equal(data, {})) {
        logMissingFieldErrors(diff.missing);
      }

      const fromData = (data: TData | undefined) =>
        Observable.of({
          data,
          loading: isNetworkRequestInFlight(networkStatus),
          networkStatus,
          ...(diff.complete ? null : { partial: true }),
        } as ApolloQueryResult<TData>);

      if (data && this.getDocumentInfo(query).hasForcedResolvers) {
        return this.localState
          .runResolvers({
            document: query,
            remoteResult: { data },
            context,
            variables,
            onlyRunForcedResolvers: true,
          })
          .then((resolved) => fromData(resolved.data || void 0));
      }

      // Resolves https://github.com/apollographql/apollo-client/issues/10317.
      // If errorPolicy is 'none' and notifyOnNetworkStatusChange is true,
      // data was incorrectly returned from the cache on refetch:
      // if diff.missing exists, we should not return cache data.
      if (
        errorPolicy === "none" &&
        networkStatus === NetworkStatus.refetch &&
        Array.isArray(diff.missing)
      ) {
        return fromData(void 0);
      }

      return fromData(data);
    };

    const cacheWriteBehavior =
      fetchPolicy === "no-cache" ? CacheWriteBehavior.FORBID
        // Watched queries must opt into overwriting existing data on refetch,
        // by passing refetchWritePolicy: "overwrite" in their WatchQueryOptions.
      : (
        networkStatus === NetworkStatus.refetch &&
        refetchWritePolicy !== "merge"
      ) ?
        CacheWriteBehavior.OVERWRITE
      : CacheWriteBehavior.MERGE;

    const resultsFromLink = () =>
      this.getResultsFromLink<TData, TVars>(queryInfo, cacheWriteBehavior, {
        query,
        variables,
        context,
        fetchPolicy,
        errorPolicy,
      });

    const shouldNotify =
      notifyOnNetworkStatusChange &&
      typeof oldNetworkStatus === "number" &&
      oldNetworkStatus !== networkStatus &&
      isNetworkRequestInFlight(networkStatus);

    switch (fetchPolicy) {
      default:
      case "cache-first": {
        const diff = readCache();

        if (diff.complete) {
          return {
            fromLink: false,
            sources: [resultsFromCache(diff, queryInfo.markReady())],
          };
        }

        if (returnPartialData || shouldNotify) {
          return {
            fromLink: true,
            sources: [resultsFromCache(diff), resultsFromLink()],
          };
        }

        return { fromLink: true, sources: [resultsFromLink()] };
      }

      case "cache-and-network": {
        const diff = readCache();

        if (diff.complete || returnPartialData || shouldNotify) {
          return {
            fromLink: true,
            sources: [resultsFromCache(diff), resultsFromLink()],
          };
        }

        return { fromLink: true, sources: [resultsFromLink()] };
      }

      case "cache-only":
        return {
          fromLink: false,
          sources: [resultsFromCache(readCache(), queryInfo.markReady())],
        };

      case "network-only":
        if (shouldNotify) {
          return {
            fromLink: true,
            sources: [resultsFromCache(readCache()), resultsFromLink()],
          };
        }

        return { fromLink: true, sources: [resultsFromLink()] };

      case "no-cache":
        if (shouldNotify) {
          return {
            fromLink: true,
            // Note that queryInfo.getDiff() for no-cache queries does not call
            // cache.diff, but instead returns a { complete: false } stub result
            // when there is no queryInfo.diff already defined.
            sources: [resultsFromCache(queryInfo.getDiff()), resultsFromLink()],
          };
        }

        return { fromLink: true, sources: [resultsFromLink()] };

      case "standby":
        return { fromLink: false, sources: [] };
    }
  }

  private getQuery(queryId: string): QueryInfo {
    if (queryId && !this.queries.has(queryId)) {
      this.queries.set(queryId, new QueryInfo(this, queryId));
    }
    return this.queries.get(queryId)!;
  }

  private prepareContext(context = {}) {
    const newContext = this.localState.prepareContext(context);
    return {
      ...this.defaultContext,
      ...newContext,
      clientAwareness: this.clientAwareness,
    };
  }
}

// Return types used by fetchQueryByPolicy and other private methods above.
interface FetchConcastInfo {
  // Metadata properties that can be returned in addition to the Concast.
  fromLink: boolean;
}
interface SourcesAndInfo<TData> extends FetchConcastInfo {
  sources: ConcastSourcesArray<ApolloQueryResult<TData>>;
}
interface ConcastAndInfo<TData> extends FetchConcastInfo {
  concast: Concast<ApolloQueryResult<TData>>;
}
