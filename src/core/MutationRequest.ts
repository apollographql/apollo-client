import type { Cache } from "@apollo/client/cache";

import type { ApolloClient } from "./ApolloClient.js";
import type { OperationVariables, TypedDocumentNode } from "./types.js";

export class MutationRequest<
  TData,
  TVariables extends OperationVariables,
  TCache extends Cache.Implementation,
> {
  readonly options: ApolloClient.MutateOptions<TData, TVariables, TCache>;
  readonly refetchQueries: typeof this.options.refetchQueries;

  mutation: TypedDocumentNode<TData, TVariables>;
  variables: TVariables;

  constructor(options: ApolloClient.MutateOptions<TData, TVariables, TCache>) {
    const {
      mutation,
      refetchQueries = [],
      variables = {} as TVariables,
    } = options;

    this.options = options;
    this.mutation = mutation;
    this.variables = variables;
    this.refetchQueries = refetchQueries;
  }

  get optimisticResponse() {
    return this.options.optimisticResponse;
  }
}
