import { useState, useMemo, useCallback, useRef } from 'react';
import { equal } from '@wry/equality';
import {
  ApolloClient,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
  TypedDocumentNode,
  WatchQueryOptions,
  ApolloQueryResult,
} from '../../core';
import { compact } from '../../utilities';
import { useApolloClient } from './useApolloClient';
import { useSyncExternalStore } from './useSyncExternalStore';
import {
  SuspenseQueryHookOptions,
  ObservableQueryFields,
} from '../types/types';
import { useDeepMemo, useIsomorphicLayoutEffect, __use } from './internal';
// import { WrappedSuspenseCachePromise } from '../cache/SuspenseCache';
import { useSuspenseCache } from './useSuspenseCache';

const DEFAULT_FETCH_POLICY = 'cache-first';
const DEFAULT_SUSPENSE_POLICY = 'always';
const DEFAULT_ERROR_POLICY = 'none';

//////////////////////
// ⌘C + ⌘P from uSQ //
//////////////////////
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

  // if (__DEV__) {
  // validateOptions(watchQueryOptions);
  // }

  return watchQueryOptions;
}
/////////
// End //
/////////
export interface UseBackgroundQueryResult<
  TData = any,
  TVariables extends OperationVariables = OperationVariables
> {
  promise: WrappedSuspenseCachePromise;
  observable: ObservableQuery<TData, TVariables>;
  fetchMore: ObservableQueryFields<TData, TVariables>['fetchMore'];
  refetch: ObservableQueryFields<TData, TVariables>['refetch'];
}

export function useBackgroundQuery_experimental<
  TData = any,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<TData, TVariables> = Object.create(null)
): UseBackgroundQueryResult<TData, TVariables> {
  const suspenseCache = useSuspenseCache();
  const client = useApolloClient(options.client);
  const watchQueryOptions = useWatchQueryOptions({ query, options, client });
  const { variables } = watchQueryOptions;

  // let cacheEntry = suspenseCache.lookup(query, variables);
  const subscription = suspenseCache.getSubscription(
    client,
    query,
    variables,
    () => client.watchQuery(watchQueryOptions)
  );

  // todo: uncomment
  // const dispose = useTrackedSubscriptions(subscription);
  // useStrictModeSafeCleanupEffect(dispose);

  // todo: see fetchMore/refetch from uSQ
  // const fetchMore: FetchMoreFunction<TData, TVariables> = useCallback(
  //   (options) => subscription.fetchMore(options) as any,
  //   [subscription]
  // );

  // const refetch: RefetchFunction<TData, TVariables> = useCallback(
  //   (variables) => subscription.refetch(variables),
  //   [subscription]
  // );

  return useMemo(() => {
    const { promise, observable } = subscription;
    return {
      promise,
      observable,
      // fetchMore: (options) => {
      //   const promise = observable.fetchMore(options);

      //   suspenseCache.add(query, watchQueryOptions.variables, {
      //     promise,
      //     observable,
      //   });

      //   return promise;
      // },
      // refetch: (variables?: Partial<TVariables>) => {
      //   const promise = observable.refetch(variables);

      //   suspenseCache.add(query, watchQueryOptions.variables, {
      //     promise,
      //     observable,
      //   });

      //   return promise;
      // },
    };
  }, [subscription]);
}

export function useReadQuery<TData>(
  promise: Promise<ApolloQueryResult<TData>>
) {
  // todo: use ref to pseudo cache it -> if prev promise !== promise
  // todo: add option to pass in a SuspenseCache via options since it is also
  //       an option that can be passed to useBQ
  // todo: the text of the warning should mention that if we can't find do the
  //       reverse-lookup it may be for this reason (suspense cache was passed
  //       via options to one hook but not uRQ)
  const suspenseCache = useSuspenseCache(); // pass options.suspenseCache here
  __use(promise);
  const subscription = suspenseCache.getSubscriptionFromPromise(promise)!;
  return useSyncExternalStore(
    subscription.listen,
    () => subscription.result,
    () => subscription.result
  );
}
