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
} from '../types/types';
import {
  useDeepMemo,
  useLazyRef,
  useIsomorphicLayoutEffect,
  __use,
} from './internal';
import { useSuspenseCache } from './useSuspenseCache';
import { useSyncExternalStore } from './useSyncExternalStore';
import { Subscription } from 'zen-observable-ts';
import { ObservableQuerySubscription, SuspenseQueryCache } from '../cache';

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
  deferred: boolean;
  queryCache: SuspenseQueryCache;
  suspensePolicy: SuspensePolicy;
  subscription: ObservableQuerySubscription<TData>;
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

  const queryCache = suspenseCache.forClient(client);
  // While the query and variables can change over time, we can use the same
  // cache key for the lifecycle of this hook so we only need to find it either
  // the first run of this hook or after this hook has suspended for the first
  // time.
  const [cacheKey] = useState(() => queryCache.getCacheKey(query, variables));
  const subscription = queryCache.getSubscription(
    cacheKey,
    () => new ObservableQuerySubscription(client.watchQuery(watchQueryOptions))
  );

  const observable = subscription.observable;
  const result = useSubscriptionResult(subscription);

  // const context: HookContext<TData, TVariables> = {
  //   client,
  //   deferred: useIsDeferred(query),
  //   queryCache,
  //   subscription,
  //   suspensePolicy: options.suspensePolicy || DEFAULT_SUSPENSE_POLICY,
  //   watchQueryOptions,
  // };

  const [promise, setPromise] = usePromise(subscription, {
    returnPartialData: watchQueryOptions.returnPartialData ?? false,
    suspensePolicy: options.suspensePolicy ?? DEFAULT_SUSPENSE_POLICY,
    variables: watchQueryOptions.variables,
  });

  const { errorPolicy, variables } = watchQueryOptions;

  // const result = useObservableQueryResult(observable);

  console.dir({ render: { result, promise, variables } }, { depth: null });

  // Intentionally ignore the result returned from __use since we want to
  // observe results from the observable instead of the the promise.
  if (promise) {
    __use(subscription.promise);
  }

  // useEffect(() => {
  //   return () => {
  //     queryCache.remove(query, variables);
  //   };
  // }, []);

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
      notifyOnNetworkStatusChange: true, // suspensePolicy === 'always',
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

// function useObservable<TData, TVariables extends OperationVariables>(
//   context: HookContext<TData, TVariables>
// ) {
//   const { client, cacheEntry, watchQueryOptions } = context;
//   // If we have a cache entry that means we previously suspended and are reading
//   // the observable back from the suspense cache.
//   const ref = useRef(cacheEntry?.observable);

//   // If we do not have a ref set, we are executing this hook for the first time
//   // and have not yet suspended.
//   if (!ref.current) {
//     ref.current = client.watchQuery(watchQueryOptions);
//   }

//   return ref.current as ObservableQuery<TData, TVariables>;
// }

function shouldAttachPromise(
  result: Pick<ApolloQueryResult<unknown>, 'data' | 'partial'>,
  { returnPartialData }: { returnPartialData: boolean }
) {
  const hasFullResult = result.data && !result.partial;
  const hasPartialResult = result.data && result.partial;
  const usePartialResult = returnPartialData && hasPartialResult;

  return !hasFullResult && !usePartialResult;
}

// function shouldReadFromCache(fetchPolicy: WatchQueryFetchPolicy) {
//   return fetchPolicy === 'cache-first' || fetchPolicy === 'cache-and-network';
// }

interface UsePromiseOptions<TVariables extends OperationVariables> {
  returnPartialData: boolean;
  suspensePolicy: SuspensePolicy;
  variables: TVariables | undefined;
}

function usePromise<TData, TVariables extends OperationVariables>(
  subscription: ObservableQuerySubscription<TData>,
  {
    returnPartialData,
    suspensePolicy,
    variables,
  }: UsePromiseOptions<TVariables>
) {
  // const { client, deferred, watchQueryOptions, queryCache, suspensePolicy } =
  //   context;
  // const { variables, query } = watchQueryOptions;
  const previousVariablesRef = useRef(variables);
  // const previousQueryRef = useRef(query);

  const ref = useRef<Promise<ApolloQueryResult<TData>> | null | undefined>();

  // If the ref is `undefined`, we are running the hook for the first time
  if (ref.current === void 0) {
    ref.current = null;

    const result = subscription.result;

    // If we are running the hook for the first time and are in a loading state,
    // we are unable to pull results from the cache, so we need to kick off the
    // query.
    if (result.networkStatus === NetworkStatus.loading) {
      if (shouldAttachPromise(result, { returnPartialData })) {
        ref.current = subscription.promise;
      }
    }
  }

  if (!equal(variables, previousVariablesRef.current)) {
    ref.current = null;

    const promise = subscription.fetch(variables);
    const result = subscription.result;

    if (
      shouldAttachPromise(result, { returnPartialData }) &&
      suspensePolicy === 'always'
    ) {
      ref.current = promise;
    }

    previousVariablesRef.current = variables;
  }

  // if (!equal(query, previousQueryRef.current)) {
  //   ref.current = null;
  //   const promise = reobserve(observable, watchQueryOptions, {
  //     deferred,
  //     queryCache,
  //   });

  //   const result: Pick<ApolloQueryResult<TData>, 'data' | 'partial'> = {
  //     data: void 0 as TData,
  //   };

  //   // We need to read from the cache directly because
  //   // observable.getCurrentResult() returns the data from the
  //   // previous query. We are unable to detect if we have a proper cached result
  //   // for the new query.
  //   if (
  //     shouldReadFromCache(
  //       observable.options.fetchPolicy || DEFAULT_FETCH_POLICY
  //     )
  //   ) {
  //     const diff = client.cache.diff<TData>({
  //       query,
  //       variables,
  //       optimistic: true,
  //       returnPartialData: true,
  //     });

  //     if (!equal(diff.result, {})) {
  //       result.data = diff.result as TData;
  //     }

  //     result.partial = !diff.complete;
  //   }

  //   if (
  //     shouldAttachPromise(result, watchQueryOptions) &&
  //     suspensePolicy === 'always'
  //   ) {
  //     ref.current = promise;
  //   }

  //   previousQueryRef.current = query;
  // }

  // if (ref.current) {
  //   queryCache.setPromise(observable, ref.current);
  // }

  // const [, forceUpdate] = useState(0);

  function setPromise(promise: Promise<ApolloQueryResult<TData>> | null) {
    // ref.current = suspensePolicy === 'always' ? promise : null;
    // forceUpdate((c) => c + 1);
  }

  return [ref.current, setPromise] as const;
}

// function reobserve<TData, TVariables extends OperationVariables>(
//   observable: ObservableQuery<TData, TVariables>,
//   watchQueryOptions: WatchQueryOptions<TVariables, TData>,
//   {
//     deferred,
//     queryCache,
//   }: { deferred: boolean; queryCache: SuspenseQueryCache }
// ) {
//   const promise = maybeWrapConcastWithCustomPromise(
//     observable.reobserveAsConcast(getReobserveOptions(watchQueryOptions)),
//     { deferred }
//   );

//   queryCache.setPromise(observable, promise);

//   return promise;
// }

// omit fetch policy and nextFetchPolicy to prevent from overwriting them
// after we initialize the observable
// function getReobserveOptions<TData, TVariables extends OperationVariables>({
//   fetchPolicy,
//   nextFetchPolicy,
//   ...options
// }: WatchQueryOptions<TVariables, TData>) {
//   return options;
// }

function useIsDeferred(query: DocumentNode) {
  return useMemo(() => hasDirectives(['defer'], query), [query]);
}

function useSubscriptionResult<TData>(
  subscription: ObservableQuerySubscription<TData>
) {
  const isMountedRef = useRef(false);

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
        return subscription.subscribe(() => {
          if (isMountedRef.current) {
            forceUpdate();
          }
        });
      },
      [subscription]
    ),
    () => subscription.result,
    () => subscription.result
  );
}

function useObservableQueryResult<TData>(observable: ObservableQuery<TData>) {
  const resultRef = useLazyRef(() => observable.getCurrentResult());
  const isMountedRef = useRef(false);
  const subscribeTimeoutRef = useRef<NodeJS.Timeout>();

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
