import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { invariant } from 'ts-invariant';
import { equal } from '@wry/equality';
import { OperationVariables } from '../../core';
import { getApolloContext } from '../context';
import { ApolloError } from '../../errors';
import {
  ApolloClient,
  ApolloQueryResult,
  NetworkStatus,
  ObservableQuery,
  DocumentNode,
  TypedDocumentNode,
} from '../../core';
import {
  QueryDataOptions,
  QueryHookOptions,
  QueryResult,
} from '../types/types';

import { DocumentType, parser, operationName } from '../parser';

function verifyDocumentType(document: DocumentNode, type: DocumentType) {
  const operation = parser(document);
  const requiredOperationName = operationName(type);
  const usedOperationName = operationName(operation.type);
  invariant(
    operation.type === type,
    `Running a ${requiredOperationName} requires a graphql ` +
      `${requiredOperationName}, but a ${usedOperationName} was used instead.`
  );
}

export function useQuery<
  TData = any,
  TVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  hookOptions?: QueryHookOptions<TData, TVariables>,
): QueryResult<TData> {
  const context = useContext(getApolloContext());
  const client = hookOptions?.client || context.client;
  invariant(
    !!client,
    'Could not find "client" in the context or passed in as an option. ' +
    'Wrap the root component in an <ApolloProvider>, or pass an ApolloClient' +
    'ApolloClient instance in via options.',
  );
  verifyDocumentType(query, DocumentType.Query);

  // create watchQueryOptions from hook options
  const { skip, ssr, partialRefetch, options } = useMemo(() => {
    const { skip, ssr, partialRefetch, ...options } = { ...hookOptions, query };
    if (skip) {
      options.fetchPolicy = 'standby';
    } else if (
      context.renderPromises &&
      (
        options.fetchPolicy === 'network-only' ||
        options.fetchPolicy === 'cache-and-network'
      )
    ) {
      // this behavior was added to react-apollo without explanation in this PR
      // https://github.com/apollographql/react-apollo/pull/1579
      options.fetchPolicy = 'cache-first';
    } else if (!options.fetchPolicy) {
      // cache-first is the default policy, but we explicitly assign it here so
      // the cache policies computed based on optiosn can be cleared
      options.fetchPolicy = 'cache-first';
    }

    return { skip, ssr, partialRefetch, options };
  }, [hookOptions, context.renderPromises]);

  const { onCompleted, onError } = options;
  const [obsQuery, setObsQuery] = useState(() => {
    // See if there is an existing observable that was used to fetch the same
    // data and if so, use it instead since it will contain the proper queryId
    // to fetch the result set. This is used during SSR.
    let obsQuery: ObservableQuery<TData, TVariables> | null = null;
    if (context.renderPromises) {
      obsQuery = context.renderPromises.getSSRObservable(options);
    }

    if (!obsQuery) {
      obsQuery = client.watchQuery(options);
      if (context.renderPromises) {
        context.renderPromises.registerSSRObservable(
          obsQuery,
          options,
        );
      }
    }

    if (
      context.renderPromises &&
      ssr !== false &&
      !skip &&
      obsQuery.getCurrentResult().loading
    ) {
      // TODO: This is a legacy API which could probably be cleaned up
      context.renderPromises.addQueryPromise(
        {
          // The only options which seem to actually be used by the
          // RenderPromises class are query and variables.
          getOptions: () => options,
          fetchData: () => new Promise<void>((resolve) => {
            const sub = obsQuery!.subscribe(
              (result) => {
                if (!result.loading) {
                  resolve()
                  sub.unsubscribe();
                }
              },
              () => {
                resolve();
                sub.unsubscribe();
              },
              () => {
                resolve();
              },
            );
          }),
        } as any,
        () => null,
      );
    }

    return obsQuery;
  });

  let [result, setResult] = useState(() => obsQuery.getCurrentResult());
  const prevRef = useRef<{
    client: ApolloClient<unknown>,
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options: QueryDataOptions<TData, TVariables>,
    result: ApolloQueryResult<TData>,
    data: TData | undefined,
  }>({
    client,
    query,
    options,
    result,
    data: void 0,
  });

  // An effect to recreate the obsQuery whenever the client or query changes.
  // This effect is also responsible for checking and updating the obsQuery
  // options whenever they change.
  useEffect(() => {
    if (
      prevRef.current.client !== client ||
      !equal(prevRef.current.query, query)
    ) {
      setObsQuery(client.watchQuery(options));
    }

    if (!equal(prevRef.current.options, options)) {
      obsQuery.setOptions(options).catch(() => {});
      const result = obsQuery.getCurrentResult();
      const previousResult = prevRef.current.result;
      if (previousResult.data) {
        prevRef.current.data = previousResult.data;
      }

      prevRef.current.result = result;
      setResult(result);
    }

    Object.assign(prevRef.current, { client, query, options });
  }, [obsQuery, client, query, options]);

  // An effect to subscribe to the current observable query
  useEffect(() => {
    if (context.renderPromises || client.disableNetworkFetches) {
      return;
    }

    function onNext() {
      const previousResult = prevRef.current.result;
      // We use `getCurrentResult()` instead of the callback argument because
      // the values differ slightly. Specifically, loading results will have
      // an empty object for data instead of `undefined` for some reason.
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
        prevRef.current.data = previousResult.data;
      }

      prevRef.current.result = result;
      setResult(result);
    }

    function onError(error: Error) {
      const last = obsQuery["last"];
      sub.unsubscribe();
      // Unfortunately, if `lastError` is set in the current
      // `observableQuery` when the subscription is re-created,
      // the subscription will immediately receive the error, which will
      // cause it to terminate again. To avoid this, we first clear
      // the last error/result from the `observableQuery` before re-starting
      // the subscription, and restore it afterwards (so the subscription
      // has a chance to stay open).
      try {
        obsQuery.resetLastResults();
        sub = obsQuery.subscribe(onNext, onError);
      } finally {
        obsQuery["last"] = last;
      }

      if (!error.hasOwnProperty('graphQLErrors')) {
        // The error is not a graphQL error
        throw error;
      }

      const previousResult = prevRef.current.result;
      if (
        (previousResult && previousResult.loading) ||
        !equal(error, previousResult.error)
      ) {
        prevRef.current.result = {
          data: previousResult.data,
          error: error as ApolloError,
          loading: false,
          networkStatus: NetworkStatus.error,
        };
        setResult(prevRef.current.result);
      }
    }

    let sub = obsQuery.subscribe(onNext, onError);
    return () => sub.unsubscribe();
  }, [obsQuery, client.disableNetworkFetches, context.renderPromises]);

  const obsQueryFields = useMemo(() => ({
    refetch: obsQuery.refetch.bind(obsQuery),
    fetchMore: obsQuery.fetchMore.bind(obsQuery),
    updateQuery: obsQuery.updateQuery.bind(obsQuery),
    startPolling: obsQuery.startPolling.bind(obsQuery),
    stopPolling: obsQuery.stopPolling.bind(obsQuery),
    subscribeToMore: obsQuery.subscribeToMore.bind(obsQuery),
  }), [obsQuery]);

  // An effect which calls the onCompleted and onError callbacks
  useEffect(() => {
    if (!result.loading) {
      if (result.error) {
        onError?.(result.error);
      } else if (result.data) {
        onCompleted?.(result.data);
      }
    }
    // TODO: Do we need to add onCompleted and onError to the dependency array
  }, [result, onCompleted, onError]);

  let partial: boolean | undefined;
  ({ partial, ...result } = result);
  // An effect which refetches queries when there is incomplete data in the
  // cache.
  //
  // TODO: This effect should be removed when the partialRefetch option is
  // removed.
  useEffect(() => {
    // When a `Query` component is mounted, and a mutation is executed
    // that returns the same ID as the mounted `Query`, but has less
    // fields in its result, Apollo Client's `QueryManager` returns the
    // data as `undefined` since a hit can't be found in the cache.
    // This can lead to application errors when the UI elements rendered by
    // the original `Query` component are expecting certain data values to
    // exist, and they're all of a sudden stripped away. To help avoid
    // this we'll attempt to refetch the `Query` data.
    if (
      partialRefetch &&
      partial &&
      (!result.data || Object.keys(result.data).length === 0) &&
      obsQuery.options.fetchPolicy !== 'cache-only'
    ) {
      setResult((result) => ({
        ...result,
        loading: true,
        networkStatus: NetworkStatus.loading,
      }));
      setTimeout(() => obsQuery.refetch());
    }
  }, [
    partialRefetch,
    partial,
    result.data,
    obsQuery.options.fetchPolicy,
  ]);

  if (
    ssr === false &&
    (context.renderPromises || client.disableNetworkFetches)
  ) {
    // If SSR has been explicitly disabled, and this function has been called
    // on the server side, return the default loading state.
    result = prevRef.current.result = {
      loading: true,
      data: void 0 as unknown as TData,
      error: void 0,
      networkStatus: NetworkStatus.loading,
    };
  } else if (skip) {
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

  // TODO: Is this still necessary?
  // Any query errors that exist are now available in `result`, so we'll
  // remove the original errors from the `ObservableQuery` query store to
  // make sure they aren't re-displayed on subsequent (potentially error
  // free) requests/responses.
  obsQuery.resetQueryStoreErrors()
  return {
    ...obsQueryFields,
    variables: obsQuery.variables,
    client,
    called: true,
    previousData: prevRef.current.data,
    ...result,
  };
}
