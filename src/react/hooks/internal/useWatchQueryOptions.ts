import type {
  ApolloClient,
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
  WatchQueryOptions,
} from "../../../core/index.js";
import { useDeepMemo } from "./index.js";
import type { SkipToken } from "../constants.js";
import { skipToken } from "../constants.js";
import { validateOptions } from "../useSuspenseQuery.js";
import type { SuspenseQueryHookOptions } from "../../types/types.js";

export function useWatchQueryOptions<
  TData,
  TVariables extends OperationVariables,
>({
  client,
  query,
  options,
}: UseWatchQueryOptionsHookOptions<TData, TVariables>): WatchQueryOptions<
  TVariables,
  TData
> {
  return useDeepMemo<WatchQueryOptions<TVariables, TData>>(() => {
    if (options === skipToken) {
      return { query, fetchPolicy: "standby" };
    }

    const fetchPolicy =
      options.fetchPolicy ||
      client.defaultOptions.watchQuery?.fetchPolicy ||
      "cache-first";

    const watchQueryOptions = {
      ...options,
      fetchPolicy,
      query,
      notifyOnNetworkStatusChange: false,
      nextFetchPolicy: void 0,
    };

    if (__DEV__) {
      validateOptions(watchQueryOptions);
    }

    // Assign the updated fetch policy after our validation since `standby` is
    // not a supported fetch policy on its own without the use of `skip`.
    if (options.skip) {
      watchQueryOptions.fetchPolicy = "standby";
    }

    return watchQueryOptions;
  }, [client, options, query]);
}
export interface UseWatchQueryOptionsHookOptions<
  TData,
  TVariables extends OperationVariables,
> {
  client: ApolloClient<unknown>;
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
  options: SkipToken | SuspenseQueryHookOptions<TData, TVariables>;
}
