/**
 * Function parameters in this file try to follow a common order for the sake of
 * readability and consistency. The order is as follows:
 *
 * resultData
 * observable
 * client
 * query
 * options
 * watchQueryOptions
 * makeWatchQueryOptions
 */
/** */
import { equal } from "@wry/equality";
import * as React from "react";
import { asapScheduler, observeOn } from "rxjs";

import type {
  ApolloClient,
  DefaultContext,
  ErrorLike,
  ErrorPolicy,
  FetchMoreQueryOptions,
  OperationVariables,
  RefetchWritePolicy,
  SubscribeToMoreFunction,
  UpdateQueryMapFn,
  WatchQueryFetchPolicy,
} from "@apollo/client/core";
import type {
  ApolloQueryResult,
  DocumentNode,
  ObservableQuery,
  TypedDocumentNode,
  WatchQueryOptions,
} from "@apollo/client/core";
import { NetworkStatus } from "@apollo/client/core";
import type { MaybeMasked, Unmasked } from "@apollo/client/masking";
import { DocumentType, verifyDocumentType } from "@apollo/client/react/parser";
import type { NoInfer } from "@apollo/client/utilities";
import { maybeDeepFreeze, mergeOptions } from "@apollo/client/utilities";

import type { NextFetchPolicyContext } from "../../core/watchQueryOptions.js";

import { wrapHook } from "./internal/index.js";
import { useApolloClient } from "./useApolloClient.js";
import { useSyncExternalStore } from "./useSyncExternalStore.js";

export declare namespace useQuery {
  export interface Options<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > {
    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#fetchPolicy:member} */
    fetchPolicy?: WatchQueryFetchPolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#nextFetchPolicy:member} */
    nextFetchPolicy?:
      | WatchQueryFetchPolicy
      | ((
          this: WatchQueryOptions<TVariables, TData>,
          currentFetchPolicy: WatchQueryFetchPolicy,
          context: NextFetchPolicyContext<TData, TVariables>
        ) => WatchQueryFetchPolicy);
    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#initialFetchPolicy:member} */

    initialFetchPolicy?: WatchQueryFetchPolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#refetchWritePolicy:member} */
    refetchWritePolicy?: RefetchWritePolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
    variables?: TVariables;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#errorPolicy:member} */
    errorPolicy?: ErrorPolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#pollInterval:member} */
    pollInterval?: number;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#notifyOnNetworkStatusChange:member} */
    notifyOnNetworkStatusChange?: boolean;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#returnPartialData:member} */
    returnPartialData?: boolean;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#skipPollAttempt:member} */
    skipPollAttempt?: () => boolean;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#ssr:member} */
    ssr?: boolean;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#client:member} */
    client?: ApolloClient;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
    context?: DefaultContext;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#skip:member} */
    skip?: boolean;
  }

  export interface Result<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > {
    /** {@inheritDoc @apollo/client!QueryResultDocumentation#client:member} */
    client: ApolloClient;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#observable:member} */
    observable: ObservableQuery<TData, TVariables>;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#data:member} */
    data: MaybeMasked<TData> | undefined;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#previousData:member} */
    previousData?: MaybeMasked<TData>;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#error:member} */
    error?: ErrorLike;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#loading:member} */
    loading: boolean;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#networkStatus:member} */
    networkStatus: NetworkStatus;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#startPolling:member} */
    startPolling: (pollInterval: number) => void;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#stopPolling:member} */
    stopPolling: () => void;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#subscribeToMore:member} */
    subscribeToMore: SubscribeToMoreFunction<TData, TVariables>;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#updateQuery:member} */
    updateQuery: (mapFn: UpdateQueryMapFn<TData, TVariables>) => void;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#refetch:member} */
    refetch: (
      variables?: Partial<TVariables>
    ) => Promise<ApolloQueryResult<MaybeMasked<TData>>>;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#variables:member} */
    variables: TVariables | undefined;
    /** {@inheritDoc @apollo/client!QueryResultDocumentation#fetchMore:member} */

    fetchMore: <
      TFetchData = TData,
      TFetchVars extends OperationVariables = TVariables,
    >(
      fetchMoreOptions: FetchMoreQueryOptions<TFetchVars, TFetchData> & {
        updateQuery?: (
          previousQueryResult: Unmasked<TData>,
          options: {
            fetchMoreResult: Unmasked<TFetchData>;
            variables: TFetchVars;
          }
        ) => Unmasked<TData>;
      }
    ) => Promise<ApolloQueryResult<MaybeMasked<TFetchData>>>;
  }
}

type InternalQueryResult<TData, TVariables extends OperationVariables> = Omit<
  useQuery.Result<TData, TVariables>,
  | "startPolling"
  | "stopPolling"
  | "subscribeToMore"
  | "updateQuery"
  | "refetch"
  | "reobserve"
  | "fetchMore"
>;

const lastWatchOptions = Symbol();

interface ObsQueryWithMeta<TData, TVariables extends OperationVariables>
  extends ObservableQuery<TData, TVariables> {
  [lastWatchOptions]?: WatchQueryOptions<TVariables, TData>;
}

interface InternalResult<TData, TVariables extends OperationVariables> {
  // These members are populated by getCurrentResult and setResult, and it's
  // okay/normal for them to be initially undefined.
  current?: undefined | InternalQueryResult<TData, TVariables>;
  previousData?: undefined | MaybeMasked<TData>;
}

interface InternalState<TData, TVariables extends OperationVariables> {
  client: ReturnType<typeof useApolloClient>;
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
  observable: ObsQueryWithMeta<TData, TVariables>;
  resultData: InternalResult<TData, TVariables>;
}

/**
 * A hook for executing queries in an Apollo application.
 *
 * To run a query within a React component, call `useQuery` and pass it a GraphQL query document.
 *
 * When your component renders, `useQuery` returns an object from Apollo Client that contains `loading`, `error`, and `data` properties you can use to render your UI.
 *
 * > Refer to the [Queries](https://www.apollographql.com/docs/react/data/queries) section for a more in-depth overview of `useQuery`.
 *
 * @example
 * ```jsx
 * import { gql, useQuery } from '@apollo/client';
 *
 * const GET_GREETING = gql`
 *   query GetGreeting($language: String!) {
 *     greeting(language: $language) {
 *       message
 *     }
 *   }
 * `;
 *
 * function Hello() {
 *   const { loading, error, data } = useQuery(GET_GREETING, {
 *     variables: { language: 'english' },
 *   });
 *   if (loading) return <p>Loading ...</p>;
 *   return <h1>Hello {data.greeting.message}!</h1>;
 * }
 * ```
 * @since 3.0.0
 * @param query - A GraphQL query document parsed into an AST by `gql`.
 * @param options - Options to control how the query is executed.
 * @returns Query result object
 */
export function useQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useQuery.Options<NoInfer<TData>, NoInfer<TVariables>> = {}
): useQuery.Result<TData, TVariables> {
  return wrapHook(
    "useQuery",
    // eslint-disable-next-line react-compiler/react-compiler
    useQuery_,
    useApolloClient(options && options.client)
  )(query, options);
}

function useQuery_<TData, TVariables extends OperationVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useQuery.Options<NoInfer<TData>, NoInfer<TVariables>>
) {
  const result = useQueryInternals(query, options);
  const obsQueryFields = React.useMemo(
    () => bindObservableMethods(result.observable),
    [result.observable]
  );

  return React.useMemo(
    () => ({ ...result, ...obsQueryFields }),
    [result, obsQueryFields]
  );
}

function useInternalState<TData, TVariables extends OperationVariables>(
  client: ApolloClient,
  query: DocumentNode | TypedDocumentNode<any, any>,
  watchQueryOptions: WatchQueryOptions<TVariables, TData>
) {
  function createInternalState(previous?: InternalState<TData, TVariables>) {
    verifyDocumentType(query, DocumentType.Query);

    const internalState: InternalState<TData, TVariables> = {
      client,
      query,
      observable: client.watchQuery(watchQueryOptions),
      resultData: {
        // Reuse previousData from previous InternalState (if any) to provide
        // continuity of previousData even if/when the query or client changes.
        previousData: previous?.resultData.current?.data,
      },
    };

    return internalState as InternalState<TData, TVariables>;
  }

  let [internalState, updateInternalState] =
    React.useState(createInternalState);

  if (client !== internalState.client || query !== internalState.query) {
    // If the client or query have changed, we need to create a new InternalState.
    // This will trigger a re-render with the new state, but it will also continue
    // to run the current render function to completion.
    // Since we sometimes trigger some side-effects in the render function, we
    // re-assign `state` to the new state to ensure that those side-effects are
    // triggered with the new state.
    const newInternalState = createInternalState(internalState);
    updateInternalState(newInternalState);
    return newInternalState;
  }

  return internalState;
}

function useQueryInternals<TData, TVariables extends OperationVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useQuery.Options<NoInfer<TData>, NoInfer<TVariables>>
) {
  const client = useApolloClient(options.client);
  const { skip, ...otherOptions } = options;

  const watchQueryOptions: WatchQueryOptions<TVariables, TData> = mergeOptions(
    client.defaultOptions.watchQuery,
    { ...otherOptions, query }
  );

  if (skip) {
    // When skipping, we set watchQueryOptions.fetchPolicy initially to
    // "standby", but we also need/want to preserve the initial non-standby
    // fetchPolicy that would have been used if not skipping.
    watchQueryOptions.initialFetchPolicy =
      options.initialFetchPolicy || options.fetchPolicy;
    watchQueryOptions.fetchPolicy = "standby";
  }

  const { observable, resultData } = useInternalState(
    client,
    query,
    watchQueryOptions
  );

  if (!watchQueryOptions.fetchPolicy) {
    // eslint-disable-next-line react-compiler/react-compiler
    watchQueryOptions.fetchPolicy = observable.options.initialFetchPolicy;
  }

  useResubscribeIfNecessary<TData, TVariables>(
    resultData, // might get mutated during render
    observable, // might get mutated during render
    watchQueryOptions
  );

  const result = useObservableSubscriptionResult<TData, TVariables>(
    resultData,
    observable,
    client,
    options,
    watchQueryOptions
  );

  return result;
}

function useObservableSubscriptionResult<
  TData,
  TVariables extends OperationVariables,
>(
  resultData: InternalResult<TData, TVariables>,
  observable: ObservableQuery<TData, TVariables>,
  client: ApolloClient,
  options: useQuery.Options<NoInfer<TData>, NoInfer<TVariables>>,
  watchQueryOptions: Readonly<WatchQueryOptions<TVariables, TData>>
) {
  const ssrDisabledOverride = useSyncExternalStore(
    () => () => {},
    () => false,
    () => options.ssr === false
  );

  const resultOverride =
    options.skip || watchQueryOptions.fetchPolicy === "standby" ?
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
      useQuery.skipStandbyResult
    : ssrDisabledOverride ? useQuery.ssrDisabledResult
    : void 0;

  const previousData = resultData.previousData;
  const currentResultOverride = React.useMemo(
    () =>
      resultOverride &&
      toQueryResult(resultOverride, previousData, observable, client),
    [client, observable, resultOverride, previousData]
  );

  return useSyncExternalStore(
    React.useCallback(
      (handleStoreChange) => {
        const subscription = observable
          // We use the asapScheduler here to prevent issues with trying to
          // update in the middle of a render. `reobserve` is kicked off in the
          // middle of a render and because RxJS emits values synchronously,
          // its possible for this `handleStoreChange` to be called in that same
          // render. This allows the render to complete before trying to emit a
          // new value.
          .pipe(observeOn(asapScheduler))
          .subscribe((result) => {
            const previousResult = resultData.current;
            // Make sure we're not attempting to re-render similar results
            // TODO: Eventually move this check inside ObservableQuery. We should
            // probably not emit a new result if the result is the same.
            if (
              previousResult &&
              previousResult.loading === result.loading &&
              previousResult.networkStatus === result.networkStatus &&
              equal(previousResult.data, result.data) &&
              equal(previousResult.error, result.error)
            ) {
              return;
            }

            if (previousResult && previousResult.data) {
              resultData.previousData = previousResult.data;
            }

            resultData.current = toQueryResult(
              result,
              resultData.previousData,
              observable,
              client
            );
            handleStoreChange();
          });

        // Do the "unsubscribe" with a short delay.
        // This way, an existing subscription can be reused without an additional
        // request if "unsubscribe"  and "resubscribe" to the same ObservableQuery
        // happen in very fast succession.
        return () => {
          setTimeout(() => subscription.unsubscribe());
        };
      },

      [observable, resultData, client]
    ),
    () =>
      currentResultOverride || getCurrentResult(resultData, observable, client),
    () =>
      currentResultOverride || getCurrentResult(resultData, observable, client)
  );
}

// this hook is not compatible with any rules of React, and there's no good way to rewrite it.
// it should stay a separate hook that will not be optimized by the compiler
function useResubscribeIfNecessary<
  TData,
  TVariables extends OperationVariables,
>(
  /** this hook will mutate properties on `resultData` */
  resultData: InternalResult<TData, TVariables>,
  /** this hook will mutate properties on `observable` */
  observable: ObsQueryWithMeta<TData, TVariables>,
  watchQueryOptions: Readonly<WatchQueryOptions<TVariables, TData>>
) {
  if (
    observable[lastWatchOptions] &&
    !equal(observable[lastWatchOptions], watchQueryOptions)
  ) {
    // Though it might be tempting to postpone this reobserve call to the
    // useEffect block, we need getCurrentResult to return an appropriate
    // loading:true result synchronously (later within the same call to
    // useQuery). Since we already have this.observable here (not true for
    // the very first call to useQuery), we are not initiating any new
    // subscriptions, though it does feel less than ideal that reobserve
    // (potentially) kicks off a network request (for example, when the
    // variables have changed), which is technically a side-effect.
    observable.reobserve(watchQueryOptions);

    // Make sure getCurrentResult returns a fresh ApolloQueryResult<TData>,
    // but save the current data as this.previousData, just like setResult
    // usually does.
    resultData.previousData =
      resultData.current?.data || resultData.previousData;
    resultData.current = void 0;
  }
  observable[lastWatchOptions] = watchQueryOptions;
}

function getCurrentResult<TData, TVariables extends OperationVariables>(
  resultData: InternalResult<TData, TVariables>,
  observable: ObservableQuery<TData, TVariables>,
  client: ApolloClient
): InternalQueryResult<TData, TVariables> {
  // Using this.result as a cache ensures getCurrentResult continues returning
  // the same (===) result object, unless state.setResult has been called, or
  // we're doing server rendering and therefore override the result below.
  if (!resultData.current) {
    resultData.current = toQueryResult(
      observable.getCurrentResult(),
      resultData.previousData,
      observable,
      client
    );
  }
  return resultData.current;
}

function toQueryResult<TData, TVariables extends OperationVariables>(
  result: ApolloQueryResult<MaybeMasked<TData>>,
  previousData: MaybeMasked<TData> | undefined,
  observable: ObservableQuery<TData, TVariables>,
  client: ApolloClient
): InternalQueryResult<TData, TVariables> {
  const { data, partial, ...resultWithoutPartial } = result;
  const queryResult: InternalQueryResult<TData, TVariables> = {
    data, // Ensure always defined, even if result.data is missing.
    ...resultWithoutPartial,
    client: client,
    observable: observable,
    variables: observable.variables,
    previousData,
  };
  return queryResult;
}

useQuery.ssrDisabledResult = maybeDeepFreeze({
  loading: true,
  data: void 0 as any,
  error: void 0,
  networkStatus: NetworkStatus.loading,
  partial: true,
});

useQuery.skipStandbyResult = maybeDeepFreeze({
  loading: false,
  data: void 0 as any,
  error: void 0,
  networkStatus: NetworkStatus.ready,
  partial: true,
});

function bindObservableMethods<TData, TVariables extends OperationVariables>(
  observable: ObservableQuery<TData, TVariables>
) {
  return {
    refetch: observable.refetch.bind(observable),
    fetchMore: observable.fetchMore.bind(observable),
    updateQuery: observable.updateQuery.bind(observable),
    startPolling: observable.startPolling.bind(observable),
    stopPolling: observable.stopPolling.bind(observable),
    subscribeToMore: observable.subscribeToMore.bind(observable),
  };
}
