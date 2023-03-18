import { invariant, __DEV__ } from '../../utilities/globals';
import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { equal } from '@wry/equality';
import {
  ApolloClient,
  ApolloError,
  ApolloQueryResult,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
  TypedDocumentNode,
  WatchQueryOptions,
  WatchQueryFetchPolicy,
  NetworkStatus,
} from '../../core';
import {
  compact,
  Concast,
  isNonEmptyArray,
  hasDirectives,
} from '../../utilities';
import { useApolloClient } from './useApolloClient';
import { DocumentType, verifyDocumentType } from '../parser';
import {
  SuspenseQueryHookOptions,
  ObservableQueryFields,
  SuspensePolicy,
  SuspenseQueryHookFetchPolicy,
} from '../types/types';
import { useDeepMemo, useIsomorphicLayoutEffect, __use } from './internal';
import { useSuspenseCache } from './useSuspenseCache';
import { useSyncExternalStore } from './useSyncExternalStore';
import { Subscription } from 'zen-observable-ts';
import { CacheEntry, SuspenseCache } from '../cache';

export interface UseSuspenseQueryResult<
  TData = any,
  TVariables extends OperationVariables = OperationVariables
> {
  client: ApolloClient<any>;
  data: TData;
  error: ApolloError | undefined;
  fetchMore: FetchMoreFunction<TData, TVariables>;
  networkStatus: NetworkStatus;
  refetch: RefetchFunction<TData, TVariables>;
  subscribeToMore: SubscribeToMoreFunction<TData, TVariables>;
}

type FetchMoreFunction<
  TData,
  TVariables extends OperationVariables
> = ObservableQueryFields<TData, TVariables>['fetchMore'];

type RefetchFunction<
  TData,
  TVariables extends OperationVariables
> = ObservableQueryFields<TData, TVariables>['refetch'];

type SubscribeToMoreFunction<
  TData,
  TVariables extends OperationVariables
> = ObservableQueryFields<TData, TVariables>['subscribeToMore'];

const SUPPORTED_FETCH_POLICIES: WatchQueryFetchPolicy[] = [
  'cache-first',
  'network-only',
  'no-cache',
  'cache-and-network',
];

const DEFAULT_FETCH_POLICY = 'cache-first';
const DEFAULT_SUSPENSE_POLICY = 'always';
const DEFAULT_ERROR_POLICY = 'none';

interface HookContext<TData, TVariables extends OperationVariables> {
  client: ApolloClient<any>;
  cacheEntry: CacheEntry<TData, TVariables> | undefined;
  deferred: boolean;
  suspenseCache: SuspenseCache;
  suspensePolicy: SuspensePolicy;
  watchQueryOptions: WatchQueryOptions<TVariables, TData>;
}

export function useSuspenseQuery_experimental<
  TData = any,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<TData, TVariables> = Object.create(null)
): UseSuspenseQueryResult<TData, TVariables> {
  const client = useApolloClient(options.client);
  const suspenseCache = useSuspenseCache(options.suspenseCache);
  const watchQueryOptions = useWatchQueryOptions({ query, options, client });
  let cacheEntry = suspenseCache.lookup(query, watchQueryOptions.variables);

  const context: HookContext<TData, TVariables> = {
    client,
    cacheEntry,
    deferred: useIsDeferred(query),
    suspenseCache,
    suspensePolicy: options.suspensePolicy || DEFAULT_SUSPENSE_POLICY,
    watchQueryOptions,
  };

  // const previousWatchQueryOptionsRef = useRef(watchQueryOptions);
  const observable = useObservable(context);
  const [promise, setPromise] = usePromise(observable, context);

  const { errorPolicy, variables } = watchQueryOptions;

  const result = useObservableQueryResult(observable);

  __use(promise);

  // const hasFullResult = result.data && !result.partial;
  // const hasPartialResult = result.data && result.partial;
  // const usePartialResult = returnPartialData && hasPartialResult;

  // const allowsThrownErrors =
  //   // If we've got a deferred query that errors on an incremental chunk, we
  //   // will have a partial result before the error is collected. We do not want
  //   // to throw errors that have been returned from incremental chunks. Instead
  //   // we offload those errors to the `error` property.
  //   errorPolicy === 'none' && (!context.deferred || !hasPartialResult);

  // if (
  //   result.error &&
  //   // Always throw network errors regardless of the error policy
  //   (result.error.networkError || allowsThrownErrors)
  // ) {
  //   throw result.error;
  // }

  // if (result.loading) {
  //   // If we don't have a cache entry, but we are in a loading state, we are on
  //   // the first run of the hook. Kick off a network request so we can suspend
  //   // immediately
  //   // if (!cacheEntry) {
  //   //   cacheEntry = suspenseCache.add({
  //   //     query,
  //   //     variables,
  //   //     promise: maybeWrapConcastWithCustomPromise(
  //   //       observable.reobserveAsConcast(watchQueryOptions),
  //   //       { deferred: context.deferred }
  //   //     ),
  //   //     observable,
  //   //   });
  //   // }

  //   const hasUsableResult =
  //     // When we have partial data in the cache, a network request will be kicked
  //     // off to load the full set of data. Avoid suspending when the request is
  //     // in flight to return the partial data immediately.
  //     usePartialResult ||
  //     // `cache-and-network` kicks off a network request even with a full set of
  //     // data in the cache, which means the loading state will be set to `true`.
  //     // Avoid suspending in this case.
  //     (fetchPolicy === 'cache-and-network' && hasFullResult);

  //   if (!hasUsableResult) {
  //     __use(promise);
  //   }
  // }

  // useEffect(() => {
  //   const { variables, query } = watchQueryOptions;
  //   const previousOpts = previousWatchQueryOptionsRef.current;

  //   if (variables !== previousOpts.variables || query !== previousOpts.query) {
  //     suspenseCache.remove(previousOpts.query, previousOpts.variables);

  //     suspenseCache.add({
  //       query,
  //       variables,
  //       promise: observable.reobserve({ query, variables }),
  //       observable,
  //     });

  //     previousWatchQueryOptionsRef.current = watchQueryOptions;
  //   }
  // }, [watchQueryOptions]);

  useEffect(() => {
    return () => {
      suspenseCache.remove(query, variables);
    };
  }, []);

  const fetchMore: FetchMoreFunction<TData, TVariables> = useCallback(
    (options) => {
      const promise = observable.fetchMore(options);

      setPromise(promise);

      return promise;
    },
    [observable]
  );

  const refetch: RefetchFunction<TData, TVariables> = useCallback(
    (variables) => {
      const promise = observable.refetch(variables);

      setPromise(promise);

      return promise;
    },
    [observable]
  );

  const subscribeToMore: SubscribeToMoreFunction<TData, TVariables> =
    useCallback((options) => observable.subscribeToMore(options), [observable]);

  return useMemo(() => {
    return {
      client,
      data: result.data,
      error: errorPolicy === 'ignore' ? void 0 : toApolloError(result),
      networkStatus: result.networkStatus,
      fetchMore,
      refetch,
      subscribeToMore,
    };
  }, [
    client,
    fetchMore,
    refetch,
    result,
    observable,
    errorPolicy,
    subscribeToMore,
  ]);
}

function validateOptions(options: WatchQueryOptions) {
  const {
    query,
    fetchPolicy = DEFAULT_FETCH_POLICY,
    returnPartialData,
  } = options;

  verifyDocumentType(query, DocumentType.Query);
  validateFetchPolicy(fetchPolicy);
  validatePartialDataReturn(fetchPolicy, returnPartialData);
}

function validateFetchPolicy(fetchPolicy: WatchQueryFetchPolicy) {
  invariant(
    SUPPORTED_FETCH_POLICIES.includes(fetchPolicy),
    `The fetch policy \`${fetchPolicy}\` is not supported with suspense.`
  );
}

function validatePartialDataReturn(
  fetchPolicy: WatchQueryFetchPolicy,
  returnPartialData: boolean | undefined
) {
  if (fetchPolicy === 'no-cache' && returnPartialData) {
    invariant.warn(
      'Using `returnPartialData` with a `no-cache` fetch policy has no effect. To read partial data from the cache, consider using an alternate fetch policy.'
    );
  }
}

function toApolloError(result: ApolloQueryResult<any>) {
  return isNonEmptyArray(result.errors)
    ? new ApolloError({ graphQLErrors: result.errors })
    : result.error;
}

function maybeWrapConcastWithCustomPromise<TData>(
  concast: Concast<ApolloQueryResult<TData>>,
  { deferred }: { deferred: boolean }
): Promise<ApolloQueryResult<TData>> {
  if (deferred) {
    return new Promise((resolve, reject) => {
      // Unlike `concast.promise`, we want to resolve the promise on the initial
      // chunk of the deferred query. This allows the component to unsuspend
      // when we get the initial set of data, rather than waiting until all
      // chunks have been loaded.
      const subscription = concast.subscribe({
        next: (value) => {
          resolve(value);
          subscription.unsubscribe();
        },
        error: reject,
      });
    });
  }

  return concast.promise;
}

interface UseWatchQueryOptionsHookOptions<
  TData,
  TVariables extends OperationVariables
> {
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
  options: SuspenseQueryHookOptions<TData, TVariables>;
  client: ApolloClient<any>;
}

function useWatchQueryOptions<TData, TVariables extends OperationVariables>({
  query,
  options,
  client,
}: UseWatchQueryOptionsHookOptions<TData, TVariables>): WatchQueryOptions<
  TVariables,
  TData
> {
  const { watchQuery: defaultOptions } = client.defaultOptions;

  const watchQueryOptions = useDeepMemo<
    WatchQueryOptions<TVariables, TData>
  >(() => {
    const {
      errorPolicy,
      fetchPolicy,
      suspensePolicy = DEFAULT_SUSPENSE_POLICY,
      variables,
      ...watchQueryOptions
    } = options;

    return {
      ...watchQueryOptions,
      query,
      errorPolicy:
        errorPolicy || defaultOptions?.errorPolicy || DEFAULT_ERROR_POLICY,
      fetchPolicy:
        fetchPolicy || defaultOptions?.fetchPolicy || DEFAULT_FETCH_POLICY,
      notifyOnNetworkStatusChange: suspensePolicy === 'always',
      // By default, `ObservableQuery` will run `reobserve` the first time
      // something `subscribe`s to the observable, which kicks off a network
      // request. This creates a problem for suspense because we need to begin
      // fetching the data immediately so we can throw the promise on the first
      // render. Since we don't subscribe until after we've unsuspended, we need
      // to avoid kicking off another network request for the same data we just
      // fetched. This option toggles that behavior off to avoid the `reobserve`
      // when the observable is first subscribed to.
      fetchOnFirstSubscribe: false,
      variables: compact({ ...defaultOptions?.variables, ...variables }),
    };
  }, [options, query, defaultOptions]);

  if (__DEV__) {
    validateOptions(watchQueryOptions);
  }

  return watchQueryOptions;
}

function useObservable<TData, TVariables extends OperationVariables>(
  context: HookContext<TData, TVariables>
) {
  const { client, cacheEntry, watchQueryOptions } = context;
  // If we have a cache entry that means we previously suspended and are reading
  // the observable back from the suspense cache.
  const ref = useRef(cacheEntry?.observable);

  // If we do not have a ref set, we are executing this hook for the first time
  // and have not yet suspended.
  if (!ref.current) {
    ref.current = client.watchQuery(watchQueryOptions);
  }

  return ref.current as ObservableQuery<TData, TVariables>;
}

function shouldAttachPromise(
  result: Pick<ApolloQueryResult<unknown>, 'data' | 'partial'>,
  watchQueryOptions: WatchQueryOptions<OperationVariables, unknown>
) {
  const hasFullResult = result.data && !result.partial;
  const hasPartialResult = result.data && result.partial;
  const usePartialResult =
    watchQueryOptions.returnPartialData && hasPartialResult;

  return !hasFullResult && !usePartialResult;
}

function shouldReadFromCache(fetchPolicy: SuspenseQueryHookFetchPolicy) {
  return fetchPolicy === 'cache-first' || fetchPolicy === 'cache-and-network';
}

function usePromise<TData, TVariables extends OperationVariables>(
  observable: ObservableQuery<TData, TVariables>,
  context: HookContext<TData, TVariables>
) {
  const {
    client,
    cacheEntry,
    watchQueryOptions,
    suspenseCache,
    suspensePolicy,
  } = context;
  const { variables, query } = watchQueryOptions;
  const previousVariablesRef = useRef(variables);
  const previousQueryRef = useRef(query);

  const ref = useRef<Promise<ApolloQueryResult<TData>> | null | undefined>(
    cacheEntry?.promise
  );

  // If the ref value is `undefined`, we are running the hook for the first time
  if (ref.current === void 0) {
    ref.current = null;

    const result = observable.getCurrentResult();

    // If we are running the hook for the first time and are in a loading state,
    // we are unable to pull results from the cache, so we need to kick off the
    // query.
    if (result.networkStatus === NetworkStatus.loading) {
      const promise = maybeWrapConcastWithCustomPromise(
        observable.reobserveAsConcast(watchQueryOptions),
        { deferred: context.deferred }
      );

      if (shouldAttachPromise(result, watchQueryOptions)) {
        ref.current = promise;
      }
    }
  }

  if (!equal(variables, previousVariablesRef.current)) {
    const promise = maybeWrapConcastWithCustomPromise(
      observable.reobserveAsConcast(watchQueryOptions),
      { deferred: context.deferred }
    );

    const result = observable.getCurrentResult();

    if (
      shouldAttachPromise(result, watchQueryOptions) &&
      suspensePolicy === 'always'
    ) {
      ref.current = promise;
    }

    previousVariablesRef.current = variables;
  }

  if (!equal(query, previousQueryRef.current)) {
    const promise = maybeWrapConcastWithCustomPromise(
      observable.reobserveAsConcast(watchQueryOptions),
      { deferred: context.deferred }
    );

    const result: Pick<ApolloQueryResult<TData>, 'data' | 'partial'> = {
      data: void 0 as TData,
    };

    // We need to read from the cache directly because
    // observable.getCurrentResult() returns the data from the
    // previous query. We are unable to detect if we have a proper cached result
    // for the new query.
    if (
      shouldReadFromCache(
        watchQueryOptions.fetchPolicy as SuspenseQueryHookFetchPolicy
      )
    ) {
      const diff = client.cache.diff<TData>({
        query,
        variables,
        optimistic: true,
        returnPartialData: true,
      });

      if (!equal(diff.result, {})) {
        result.data = diff.result as TData;
      }

      result.partial = !diff.complete;
    }

    if (
      shouldAttachPromise(result, watchQueryOptions) &&
      suspensePolicy === 'always'
    ) {
      ref.current = promise;
    }

    previousQueryRef.current = query;
  }

  if (ref.current) {
    const { query, variables } = watchQueryOptions;

    suspenseCache.add({ query, variables, promise: ref.current, observable });
  }

  const [, forceUpdate] = useState(0);

  function setPromise(promise: Promise<ApolloQueryResult<TData>> | null) {
    ref.current = suspensePolicy === 'always' ? promise : null;
    forceUpdate((c) => c + 1);
  }

  return [ref.current, setPromise] as const;
}

function useIsDeferred(query: DocumentNode) {
  return useMemo(() => hasDirectives(['defer'], query), [query]);
}

function useObservableQueryResult<TData>(observable: ObservableQuery<TData>) {
  const resultRef = useRef<ApolloQueryResult<TData>>();
  const isMountedRef = useRef(false);
  const subscribeTimeoutRef = useRef<NodeJS.Timeout>();

  if (!resultRef.current) {
    resultRef.current = observable.getCurrentResult();
  }

  // React keeps refs and effects from useSyncExternalStore around after the
  // component initially mounts even if the component re-suspends. We need to
  // track when the component suspends/unsuspends to ensure we don't try and
  // update the component while its suspended since the observable's
  // `next` function is called before the promise resolved.
  //
  // Unlike useEffect, useLayoutEffect will run its cleanup and initialization
  // functions each time a component is suspended.
  useIsomorphicLayoutEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useSyncExternalStore(
    useCallback(
      (forceUpdate) => {
        clearTimeout(subscribeTimeoutRef.current);

        function handleUpdate() {
          const previousResult = resultRef.current!;
          const result = observable.getCurrentResult();

          if (
            previousResult.loading === result.loading &&
            previousResult.networkStatus === result.networkStatus &&
            equal(previousResult.data, result.data)
          ) {
            return;
          }

          resultRef.current = result;

          if (isMountedRef.current) {
            forceUpdate();
          }
        }

        let subscription: Subscription;

        // We use a `setTimeout` here to avoid issues in React's strict mode
        // where the subscription would be torn down, but resubscribing would
        // be stuck in the torn down state, therefore updates to the cache would
        // not trigger the observable's subscription. This occurs due to the new
        // `fetchOnFirstSubscribe` option introduced with `useSuspenseQuery`,
        // which avoids issuing a network request (via `reobserve`) when calling
        // `subscribe` on the observable. Unfortunately `reobserve` is required
        // to put the observable back into a non-torn-down state, which is not
        // called due to this option. Instead we try delaying calling subscribe
        // for the first time by allowing React to run this effect, tear it down,
        // then set it back up again before we resubscribe.
        //
        // Authors note (Jerel): This feels super hacky and I hate it, but this
        // seems like the best approach to avoid completely changing around the
        // internals of ObservableQuery, which could introduce new bugs if I'm
        // not careful. Ideally we could call `subscribe()`, `unsubscribe()`,
        // then `subscribe()` again and be back into a normal state, but this
        // might require a sizable refactor to accomplish.
        //
        // Related to https://github.com/apollographql/apollo-client/issues/10428
        subscribeTimeoutRef.current = setTimeout(() => {
          subscription = observable.subscribe({
            next: handleUpdate,
            error: handleUpdate,
          });

          // Fixes an issue where mounting this hook with data already in the
          // cache while using a cache-first fetch policy did not respond to
          // cache updates.
          //
          // This is due to the fact that this hook manages the
          // fetching lifecycle (via `reobserve`) rather than the subscription.
          // We disable fetching when subscribing to the observable since we
          // kick off the fetch in the first render. This however has some
          // downstream issues, since `reobserve` is necessary to set some
          // internal state updates on `ObservableQuery` and `QueryInfo`. In
          // cases where we can fulfill the result via the cache immediately, we
          // avoid calling `reobserve` by subscribing (via the
          // `fetchOnFirstSubscribe` option) to avoid the network request, but
          // this means the interal state updates do not happen.
          //
          // In this case, `QueryInfo`, is initialized with a `networkStatus` of
          // 1, but because we don't call `reobserve`, this value never gets
          // updated to 7 even though `observableQuery.getCurrentResult()` is
          // able to correctly set this value to 7. This caused issues where
          // `broadcastQueries` was not sending notifications since `queryInfo`
          // avoids broadcasting to in-flight queries for fetch policies other
          // than cache-only and cache-and-network.
          //
          // This attempts to patch the behavior expected from `reobserve` by
          // marking the queryInfo as ready if we detect that the result is also
          // ready.
          //
          // Related to https://github.com/apollographql/apollo-client/issues/10478
          const result = resultRef.current!;

          if (
            result.networkStatus !== observable['queryInfo'].networkStatus &&
            result.networkStatus === NetworkStatus.ready
          ) {
            observable['queryInfo'].markReady();
          }
        });

        return () => {
          subscription?.unsubscribe();
        };
      },
      [observable]
    ),
    () => resultRef.current!,
    () => resultRef.current!
  );
}
