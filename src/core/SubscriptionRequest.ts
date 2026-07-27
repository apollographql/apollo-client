import type { ApolloClient } from "./ApolloClient.js";
import type {
  DefaultContext,
  OperationVariables,
  TypedDocumentNode,
} from "./types.js";
import type { ErrorPolicy, FetchPolicy } from "./watchQueryOptions.js";

export class SubscriptionRequest<TData, TVariables extends OperationVariables> {
  readonly extensions: Record<string, any>;
  readonly context: DefaultContext;
  readonly errorPolicy: ErrorPolicy;
  readonly fetchPolicy: FetchPolicy;
  readonly options: ApolloClient.SubscribeOptions<TData, TVariables>;

  query: TypedDocumentNode<TData, TVariables>;
  variables: TVariables;

  constructor(options: ApolloClient.SubscribeOptions<TData, TVariables>) {
    const {
      context = {},
      errorPolicy = "none",
      extensions = {},
      fetchPolicy = "cache-first",
      query,
      variables = {} as TVariables,
    } = options;

    this.context = context;
    this.errorPolicy = errorPolicy;
    this.extensions = extensions;
    this.fetchPolicy = fetchPolicy;
    this.options = options;
    this.query = query;
    this.variables = variables;
  }
}
