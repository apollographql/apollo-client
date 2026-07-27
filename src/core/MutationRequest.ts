import type { Cache } from "@apollo/client/cache";

import type { ApolloClient } from "./ApolloClient.js";
import type { OperationVariables } from "./types.js";

export class MutationRequest<
  TData,
  TVariables extends OperationVariables,
  TCache extends Cache.Implementation,
> {
  readonly options: ApolloClient.MutateOptions<TData, TVariables, TCache>;

  constructor(options: ApolloClient.MutateOptions<TData, TVariables, TCache>) {
    this.options = options;
  }
}
