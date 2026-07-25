import type { ApolloClient } from "./ApolloClient.js";
import { NetworkStatus } from "./networkStatus.js";
import { CacheWriteBehavior } from "./QueryInfo.js";
import type {
  DefaultContext,
  OperationVariables,
  TypedDocumentNode,
} from "./types.js";
import type {
  ErrorPolicy,
  WatchQueryFetchPolicy,
} from "./watchQueryOptions.js";

export class QueryRequest<TData, TVariables extends OperationVariables> {
  readonly context: DefaultContext;
  readonly errorPolicy: ErrorPolicy;
  readonly fetchPolicy: WatchQueryFetchPolicy;
  readonly query: TypedDocumentNode<TData, TVariables>;
  readonly returnPartialData: boolean;
  readonly options: ApolloClient.WatchQueryOptions<TData, TVariables>;
  readonly networkStatus: NetworkStatus;

  variables: TVariables;

  constructor(
    options: Omit<
      ApolloClient.WatchQueryOptions<TData, TVariables>,
      "variables"
    > & { variables: TVariables },
    networkStatus: NetworkStatus
  ) {
    const {
      query,
      context = {},
      errorPolicy = "none",
      fetchPolicy = "cache-first",
      returnPartialData = false,
      variables,
    } = options;

    this.options = options;
    this.networkStatus = networkStatus;
    this.context = context;
    this.errorPolicy = errorPolicy;
    this.fetchPolicy = fetchPolicy;
    this.query = query;
    this.returnPartialData = returnPartialData;
    this.variables = variables;
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
