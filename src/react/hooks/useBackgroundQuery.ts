import { useRef, useEffect } from "react";
import { unstable_batchedUpdates } from "react-dom";
import equal from "@wry/equality";

import {
  WatchQueryOptions,
  ObservableQuery,
  NetworkStatus,
  mergeOptions,
  makeVar,
  ReactiveVar,
  ApolloError,
} from "../../core";

import { useApolloClient } from "./useApolloClient";
import { useReactiveVar } from "./useReactiveVar";

export function useBackgroundQuery<TData, TVars>(
  queryOrOptions:
    | ObservableQuery<TData, TVars>
    | WatchQueryOptions<TVars, TData>,
): UseBackgroundQueryResult<TData, TVars> {
  const state = useInternalState(queryOrOptions);
  const { observable } = state;

  useEffect(() => {
    if (
      !isObservableQuery(queryOrOptions) &&
      !equal(state.options, queryOrOptions)
    ) {
      observable.setOptions(mergeOptions(
        observable.options,
        state.options = queryOrOptions,
      ));
    }

    const sub = observable.subscribe({
      next(result) {
        unstable_batchedUpdates(() => {
          state.loadingVar(result.loading);
          state.networkStatusVar(result.networkStatus);
          state.errorVar(result.error);
          state.dataVar(result.data);
        });
      },

      error(error) {
        unstable_batchedUpdates(() => {
          state.loadingVar(false);
          state.networkStatusVar(NetworkStatus.error);
          state.errorVar(error);
          // Intentionally not clearing state.dataVar, since it may still be
          // useful even though there's been an error.
          // state.dataVar(void 0);
        });
      },
    });

    return () => sub.unsubscribe();
  }, [state]);

  return state;
}

export interface UseBackgroundQueryResult<TData, TVars> {
  observable: ObservableQuery<TData, TVars>;
  // By returning hook functions that the component can choose to call (or not),
  // useBackgroundQuery is technically a "higher-order hook," in the same way a
  // function that returns other functions is a higher-order function.
  useLoading(): boolean;
  useNetworkStatus(): NetworkStatus;
  useError(): ApolloError | undefined;
  useData(): TData | undefined;
}

interface InternalState<TData, TVars>
extends UseBackgroundQueryResult<TData, TVars> {
  options: WatchQueryOptions<TVars, TData>;
  loadingVar: ReactiveVar<boolean>;
  networkStatusVar: ReactiveVar<NetworkStatus>;
  errorVar: ReactiveVar<ApolloError | undefined>;
  dataVar: ReactiveVar<TData | undefined>;
}

function useInternalState<TData, TVars>(
  queryOrOptions:
    | ObservableQuery<TData, TVars>
    | WatchQueryOptions<TVars, TData>,
): InternalState<TData, TVars> {
  const client = useApolloClient();
  const ref = useRef<InternalState<TData, TVars>>();
  return ref.current || (
    ref.current = isObservableQuery(queryOrOptions)
      ? internalStateFromObservableQuery(queryOrOptions)
      : internalStateFromOptions(client, queryOrOptions)
  );
}

function isObservableQuery(value: any): value is ObservableQuery<any, any> {
  return value instanceof ObservableQuery;
}

function makeSharedVars<TData, TVars>(
  observable: ObservableQuery<TData, TVars>,
) {
  const result = observable.getCurrentResult();
  const loadingVar = makeVar(result.loading);
  const networkStatusVar = makeVar(result.networkStatus);
  const errorVar = makeVar(result.error);
  const dataVar = makeVar(result.data);

  return {
    loadingVar,
    networkStatusVar,
    errorVar,
    dataVar,

    useLoading: () => useReactiveVar(loadingVar),
    useNetworkStatus: () => useReactiveVar(networkStatusVar),
    useError: () => useReactiveVar(errorVar),
    useData: () => useReactiveVar(dataVar),
  };
}

function internalStateFromObservableQuery<TData, TVars>(
  observable: ObservableQuery<TData, TVars>,
): InternalState<TData, TVars> {
  return Object.assign(makeSharedVars(observable), {
    observable: observable,
    options: observable.options,
  });
}

function internalStateFromOptions<TData, TVars>(
  client: ReturnType<typeof useApolloClient>,
  options: WatchQueryOptions<TVars, TData>,
): InternalState<TData, TVars> {
  const observable = client.watchQuery(options);
  return Object.assign(makeSharedVars(observable), {
    observable,
    options,
  });
}
