import type { ApolloClient } from "./ApolloClient.js";
import type { OperationVariables } from "./types.js";

export class SubscriptionRequest<TData, TVariables extends OperationVariables> {
  readonly options: ApolloClient.SubscribeOptions<TData, TVariables>;

  constructor(options: ApolloClient.SubscribeOptions<TData, TVariables>) {
    this.options = options;
  }
}
