import type { ApolloClient } from "./ApolloClient.js";
import { NetworkStatus } from "./networkStatus.js";
import { CacheWriteBehavior } from "./QueryInfo.js";
import type { OperationVariables } from "./types.js";

export class QueryRequest<TData, TVariables extends OperationVariables> {
  readonly options: ApolloClient.WatchQueryOptions<TData, TVariables>;
  readonly networkStatus: NetworkStatus;

  constructor(
    options: ApolloClient.WatchQueryOptions<TData, TVariables>,
    networkStatus: NetworkStatus
  ) {
    this.options = options;
    this.networkStatus = networkStatus;
  }

  get query() {
    return this.options.query;
  }

  get fetchPolicy() {
    return this.options.fetchPolicy;
  }

  get cacheWriteBehavior() {
    return (
      this.fetchPolicy === "no-cache" ? CacheWriteBehavior.FORBID
        // Watched queries must opt into overwriting existing data on refetch,
        // by passing refetchWritePolicy: "overwrite" in their WatchQueryOptions.
      : (
        this.networkStatus === NetworkStatus.refetch &&
        this.options.refetchWritePolicy !== "merge"
      ) ?
        CacheWriteBehavior.OVERWRITE
      : CacheWriteBehavior.MERGE
    );
  }
}
