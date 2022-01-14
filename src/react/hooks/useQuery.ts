import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import { equal } from '@wry/equality';
import { OperationVariables, mergeOptions } from '../../core';
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
  const defaultWatchQueryOptions = client.defaultOptions.watchQuery;
  verifyDocumentType(query, DocumentType.Query);

  const ref = useRef({
    client,
    query,
    options,
    watchQueryOptions: createWatchQueryOptions(query, options, defaultWatchQueryOptions),
  });

  const [obsQuery, setObsQuery] = useState(() => {
    const watchQueryOptions = createWatchQueryOptions(query, options, defaultWatchQueryOptions);
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
          getOptions: () => createWatchQueryOptions(query, options, defaultWatchQueryOptions),
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
                // TODO: Does this branch ever get called before next() and error()?
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

  // An effect to recreate the obsQuery whenever the client or query changes.
  // This effect is also responsible for updating the obsQuery options whenever
  // they change.
  useEffect(() => {
    const watchQueryOptions = createWatchQueryOptions(query, options, defaultWatchQueryOptions);

    if (ref.current.client !== client || !equal(ref.current.query, query)) {
      const obsQuery = client.watchQuery(watchQueryOptions);
      setObsQuery(obsQuery);
    } else if (!equal(ref.current.watchQueryOptions, watchQueryOptions)) {
      obsQuery.setOptions(watchQueryOptions);
      // We call setObsQuery to rerender the hook.
      setObsQuery(obsQuery);
    }

    Object.assign(ref.current, {
      client,
      query,
      options,
      watchQueryOptions,
    });
  }, [obsQuery, client, query, options]);

  const [subscribe, getSnapshot] = useMemo(() => {
    let previousResult: ApolloQueryResult<TData> | undefined;
    const subscribe = (forceUpdate: () => void) => {
      let subscription = obsQuery.subscribe(forceUpdate, onError);
      function onError(error: Error) {
        forceUpdate();
        subscription.unsubscribe();
        const last = obsQuery["last"];
        obsQuery.resetLastResults();
        obsQuery.subscribe(forceUpdate, onError);
        obsQuery["last"] = last;
        if (!error.hasOwnProperty('graphQLErrors')) {
          // The error is not a GraphQL error
          throw error;
        }
      }

      return () => {
        subscription.unsubscribe();
      };
    };

    const getSnapshot = () => {
      let result = obsQuery.getCurrentResult();
      if (result.errors && result.errors.length) {
        // Until a set naming convention for networkError and graphQLErrors is
        // decided upon, we map errors (graphQLErrors) to the error options.
        // TODO: Is it possible for both result.error and result.errors to be
        // defined here?
        result = {
          ...result,
          error:
            result.error || new ApolloError({ graphQLErrors: result.errors }),
        };
      }

      if (
        !previousResult ||
        previousResult.loading !== result.loading ||
        previousResult.networkStatus !== result.networkStatus ||
        !equal(previousResult.data, result.data) ||
        !equal(previousResult.error, result.error)
      ) {
        if (previousResult) {
          result = {
            ...result,
            previousData: previousResult.data || (previousResult as any).previousData,
          } as ApolloQueryResult<TData>;
        }

        previousResult = result;

        if (!result.loading) {
          if (result.data) {
            ref.current.options?.onCompleted?.(result.data);
          } else if (result.error) {
            ref.current.options?.onError?.(result.error);
          }
        }
      }

      return previousResult;
    };

    return [subscribe, getSnapshot];
  }, [obsQuery]);

  const obsQueryMethods = useMemo(() => ({
    refetch: obsQuery.refetch.bind(obsQuery),
    fetchMore: obsQuery.fetchMore.bind(obsQuery),
    updateQuery: obsQuery.updateQuery.bind(obsQuery),
    startPolling: obsQuery.startPolling.bind(obsQuery),
    stopPolling: obsQuery.stopPolling.bind(obsQuery),
    subscribeToMore: obsQuery.subscribeToMore.bind(obsQuery),
  }), [obsQuery]);

  let result = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  let partial: boolean | undefined;
  ({ partial, ...result } = result);
  if (options?.skip || options?.fetchPolicy === 'standby') {
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
  } else {
    // BAD BOY CODE BLOCK WHERE WE PUT SIDE-EFFECTS IN THE RENDER FUNCTION
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
      obsQuery.setOptions(
        createWatchQueryOptions(query, options, defaultWatchQueryOptions)
      ).catch(() => {});
    }

    // We assign options during rendering as a guard to make sure that
    // callbacks like onCompleted and onError are not stale.
    // TODO
    Object.assign(ref.current, { options });
  }

  return {
    ...obsQueryMethods,
    variables: createWatchQueryOptions(query, options, defaultWatchQueryOptions).variables,
    client,
    called: true,
    ...result,
  };
}

/**
 * A function to massage options before passing them the ObservableQuery.
 */
function createWatchQueryOptions<TData, TVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: QueryHookOptions<TData, TVariables> = {},
  defaultOptions?: Partial<WatchQueryOptions<any, any>>
): WatchQueryOptions<TVariables, TData> {
  // Using destructuring to remove hook specific options.
  const {
    skip,
    ssr,
    onCompleted,
    onError,
    displayName,
    ...otherOptions
  } = options;
  // TODO: For some reason, we pass context, which is the React Apollo Context,
  // into observable queries, and test for that.

  let watchQueryOptions = { query, ...otherOptions };
  if (defaultOptions) {
    watchQueryOptions = mergeOptions(defaultOptions, watchQueryOptions);
  }

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

  if (!watchQueryOptions.variables) {
    watchQueryOptions.variables = {} as TVariables;
  }

  return watchQueryOptions;
}
