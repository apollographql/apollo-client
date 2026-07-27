import type { Cache } from "@apollo/client/cache";

import type { ApolloClient } from "./ApolloClient.js";
import type { OperationVariables, TypedDocumentNode } from "./types.js";

export class MutationRequest<
  TData,
  TVariables extends OperationVariables,
  TCache extends Cache.Implementation,
> {
  readonly options: ApolloClient.MutateOptions<TData, TVariables, TCache>;

  mutation: TypedDocumentNode<TData, TVariables>;
  variables: TVariables;

  constructor(options: ApolloClient.MutateOptions<TData, TVariables, TCache>) {
    this.options = options;
    this.mutation = options.mutation;
    this.variables = options.variables ?? ({} as TVariables);
  }
}
