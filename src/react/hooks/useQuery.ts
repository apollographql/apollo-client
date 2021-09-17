import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { equal } from '@wry/equality';
import { OperationVariables } from '../../core';
import { getApolloContext } from '../context';
import { ApolloError } from '../../errors';
import {
  ApolloQueryResult,
  NetworkStatus,
  ObservableQuery,
  DocumentNode,
  TypedDocumentNode,
  WatchQueryOptions,
} from '../../core';
import {
  QueryHookOptions,
  QueryResult,
} from '../types/types';

import { DocumentType, verifyDocumentType } from '../parser';
import { useApolloClient } from './useApolloClient';

export function useQuery<
  TData = any,
  TVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: QueryHookOptions<TData, TVariables>,
): QueryResult<TData, TVariables> {
  const context = useContext(getApolloContext());
  const client = useApolloClient(options?.client);
  verifyDocumentType(query, DocumentType.Query);
  const [obsQuery, setObsQuery] = useState(() => {
    const watchQueryOptions = createWatchQueryOptions(query, options);
    // See if there is an existing observable that was used to fetch the same
    // data and if so, use it instead since it will contain the proper queryId
    // to fetch the result set. This is used during SSR.
    let obsQuery: ObservableQuery<TData, TVariables> | null = null;
    if (context.renderPromises) {
      obsQuery = context.renderPromises.getSSRObservable(watchQueryOptions);
    }

    if (!obsQuery) {
      // Is it safe (StrictMode/memory-wise) to call client.watchQuery here?
      obsQuery = client.watchQuery(watchQueryOptions);
      if (context.renderPromises) {
        context.renderPromises.registerSSRObservable(
          obsQuery,
          watchQueryOptions,
        );
      }
    }

    if (
      context.renderPromises &&
      options?.ssr !== false &&
      !options?.skip &&
      obsQuery.getCurrentResult().loading
    ) {
      // TODO: This is a legacy API which could probably be cleaned up
      context.renderPromises.addQueryPromise(
        {
          // The only options which seem to actually be used by the
          // RenderPromises class are query and variables.
          getOptions: () => createWatchQueryOptions(query, options),
          fetchData: () => new Promise<void>((resolve) => {
            const sub = obsQuery!.subscribe({
              next(result) {
                if (!result.loading) {
                  resolve()
                  sub.unsubscribe();
                }
              },
              error() {
                resolve();
                sub.unsubscribe();
              },
              complete() {
                resolve();
              },
            });
          }),
        },
        // This callback never seemed to do anything
        () => null,
      );
    }

    return obsQuery;
  });

  let [result, setResult] = useState(() => {
    const result = obsQuery.getCurrentResult();
    if (!result.loading && options) {
      if (result.error) {
        options.onError?.(result.error);
      } else if (result.data) {
        options.onCompleted?.(result.data);
      }
    }

    return result;
  });

  const ref = useRef({
    client,
    query,
    options,
    result,
    previousData: void 0 as TData | undefined,
    watchQueryOptions: createWatchQueryOptions(query, options),
  });

  // An effect to recreate the obsQuery whenever the client or query changes.
  // This effect is also responsible for checking and updating the obsQuery
  // options whenever they change.
  useEffect(() => {
    const watchQueryOptions = createWatchQueryOptions(query, options);
    let nextResult: ApolloQueryResult<TData> | undefined;
    if (ref.current.client !== client || !equal(ref.current.query, query)) {
      const obsQuery = client.watchQuery(watchQueryOptions);
      setObsQuery(obsQuery);
      nextResult = obsQuery.getCurrentResult();
    } else if (!equal(ref.current.watchQueryOptions, watchQueryOptions)) {
      obsQuery.setOptions(watchQueryOptions).catch(() => {});
      nextResult = obsQuery.getCurrentResult();
      ref.current.watchQueryOptions = watchQueryOptions;
    }

    if (nextResult) {
      const previousResult = ref.current.result;
      if (previousResult.data) {
        ref.current.previousData = previousResult.data;
      }

      setResult(ref.current.result = nextResult);
      if (!nextResult.loading && options) {
        if (!result.loading) {
          if (result.error) {
            options.onError?.(result.error);
          } else if (result.data) {
            options.onCompleted?.(result.data);
          }
        }
      }
    }

    Object.assign(ref.current, { client, query, options });
  }, [obsQuery, client, query, options]);

  // An effect to subscribe to the current observable query
  useEffect(() => {
    if (context.renderPromises) {
      return;
    }

    let subscription = obsQuery.subscribe(onNext, onError);
    // We use `getCurrentResult()` instead of the callback argument because
    // the values differ slightly. Specifically, loading results will have
    // an empty object for data instead of `undefined` for some reason.
    function onNext() {
      const previousResult = ref.current.result;
      const result = obsQuery.getCurrentResult();
      // Make sure we're not attempting to re-render similar results
      if (
        previousResult &&
        previousResult.loading === result.loading &&
        previousResult.networkStatus === result.networkStatus &&
        equal(previousResult.data, result.data)
      ) {
        return;
      }

      if (previousResult.data) {
        ref.current.previousData = previousResult.data;
      }

      setResult(ref.current.result = result);
      if (!result.loading) {
        ref.current.options?.onCompleted?.(result.data);
      }
    }

    function onError(error: Error) {
      const last = obsQuery["last"];
      subscription.unsubscribe();
      // Unfortunately, if `lastError` is set in the current
      // `observableQuery` when the subscription is re-created,
      // the subscription will immediately receive the error, which will
      // cause it to terminate again. To avoid this, we first clear
      // the last error/result from the `observableQuery` before re-starting
      // the subscription, and restore it afterwards (so the subscription
      // has a chance to stay open).
      try {
        obsQuery.resetLastResults();
        subscription = obsQuery.subscribe(onNext, onError);
      } finally {
        obsQuery["last"] = last;
      }

      if (!error.hasOwnProperty('graphQLErrors')) {
        // The error is not a GraphQL error
        throw error;
      }

      const previousResult = ref.current.result;
      if (
        (previousResult && previousResult.loading) ||
        !equal(error, previousResult.error)
      ) {
        setResult(ref.current.result = {
          data: previousResult.data,
          error: error as ApolloError,
          loading: false,
          networkStatus: NetworkStatus.error,
        });
        ref.current.options?.onError?.(error as ApolloError);
      }
    }

    return () => subscription.unsubscribe();
  }, [obsQuery, context.renderPromises, client.disableNetworkFetches]);

  let partial: boolean | undefined;
  ({ partial, ...result } = result);

  {
    // BAD BOY CODE BLOCK WHERE WE PUT SIDE-EFFECTS IN THE RENDER FUNCTION
    //
    // TODO: This code should be removed when the partialRefetch option is
    // removed. I was unable to get this hook to behave reasonably in certain
    // edge cases when this block was put in an effect.
    if (
      partial &&
      options?.partialRefetch &&
      !result.loading &&
      (!result.data || Object.keys(result.data).length === 0) &&
      obsQuery.options.fetchPolicy !== 'cache-only'
    ) {
      result = {
        ...result,
        loading: true,
        networkStatus: NetworkStatus.refetch,
      };

      obsQuery.refetch();
    }

    // TODO: This is a hack to make sure useLazyQuery executions update the
    // obsevable query options for ssr.
    if (
      context.renderPromises &&
      options?.ssr !== false &&
      !options?.skip &&
      result.loading
    ) {
      obsQuery.setOptions(createWatchQueryOptions(query, options)).catch(() => {});
    }
  }

  if (
    (context.renderPromises || client.disableNetworkFetches) &&
    options?.ssr === false
  ) {
    // If SSR has been explicitly disabled, and this function has been called
    // on the server side, return the default loading state.
    result = ref.current.result = {
      loading: true,
      data: void 0 as unknown as TData,
      error: void 0,
      networkStatus: NetworkStatus.loading,
    };
  } else if (options?.skip || options?.fetchPolicy === 'standby') {
    // When skipping a query (ie. we're not querying for data but still want to
    // render children), make sure the `data` is cleared out and `loading` is
    // set to `false` (since we aren't loading anything).
    //
    // NOTE: We no longer think this is the correct behavior. Skipping should
    // not automatically set `data` to `undefined`, but instead leave the
    // previous data in place. In other words, skipping should not mandate that
    // previously received data is all of a sudden removed. Unfortunately,
    // changing this is breaking, so we'll have to wait until Apollo Client 4.0
    // to address this.
    result = {
      loading: false,
      data: void 0 as unknown as TData,
      error: void 0,
      networkStatus: NetworkStatus.ready,
    };
  }

  if (result.errors && result.errors.length) {
    // Until a set naming convention for networkError and graphQLErrors is
    // decided upon, we map errors (graphQLErrors) to the error options.
    // TODO: Is it possible for both result.error and result.errors to be
    // defined here?
    result = {
      ...result,
      error: result.error || new ApolloError({ graphQLErrors: result.errors }),
    };
  }

  const obsQueryFields = useMemo(() => ({
    refetch: obsQuery.refetch.bind(obsQuery),
    fetchMore: obsQuery.fetchMore.bind(obsQuery),
    updateQuery: obsQuery.updateQuery.bind(obsQuery),
    startPolling: obsQuery.startPolling.bind(obsQuery),
    stopPolling: obsQuery.stopPolling.bind(obsQuery),
    subscribeToMore: obsQuery.subscribeToMore.bind(obsQuery),
  }), [obsQuery]);

  return {
    ...obsQueryFields,
    variables: obsQuery.variables,
    client,
    called: true,
    previousData: ref.current.previousData,
    ...result,
  };
}

function createWatchQueryOptions<TData, TVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: QueryHookOptions<TData, TVariables> = {},
): WatchQueryOptions<TVariables, TData> {
  // TODO: For some reason, we pass context, which is the React Apollo Context,
  // into observable queries, and test for that.
  // removing hook specific options
  const {
    skip,
    ssr,
    onCompleted,
    onError,
    displayName,
    ...watchQueryOptions
  } = options;

  if (skip) {
    watchQueryOptions.fetchPolicy = 'standby';
  } else if (
    watchQueryOptions.context?.renderPromises &&
    (
      watchQueryOptions.fetchPolicy === 'network-only' ||
      watchQueryOptions.fetchPolicy === 'cache-and-network'
    )
  ) {
    // this behavior was added to react-apollo without explanation in this PR
    // https://github.com/apollographql/react-apollo/pull/1579
    watchQueryOptions.fetchPolicy = 'cache-first';
  } else if (!watchQueryOptions.fetchPolicy) {
    // cache-first is the default policy, but we explicitly assign it here so
    // the cache policies computed based on options can be cleared
    watchQueryOptions.fetchPolicy = 'cache-first';
  }

  return { query, ...watchQueryOptions };
}
