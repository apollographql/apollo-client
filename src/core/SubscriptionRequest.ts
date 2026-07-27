import type { ApolloClient } from "./ApolloClient.js";
import type { OperationVariables, TypedDocumentNode } from "./types.js";
import type { ErrorPolicy, FetchPolicy } from "./watchQueryOptions.js";

export class SubscriptionRequest<TData, TVariables extends OperationVariables> {
  readonly errorPolicy: ErrorPolicy;
  readonly fetchPolicy: FetchPolicy;
  readonly options: ApolloClient.SubscribeOptions<TData, TVariables>;

  query: TypedDocumentNode<TData, TVariables>;
  variables: TVariables;

  constructor(options: ApolloClient.SubscribeOptions<TData, TVariables>) {
    const {
      errorPolicy = "none",
      fetchPolicy = "cache-first",
      query,
      variables = {} as TVariables,
    } = options;

    this.errorPolicy = errorPolicy;
    this.fetchPolicy = fetchPolicy;
    this.options = options;
    this.query = query;
    this.variables = variables;
  }
}
