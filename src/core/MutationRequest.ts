import type { Cache, IgnoreModifier } from "@apollo/client/cache";

import type { ApolloClient } from "./ApolloClient.js";
import { CacheWriteBehavior } from "./QueryInfo.js";
import type {
  DefaultContext,
  OperationVariables,
  TypedDocumentNode,
} from "./types.js";
import type { ErrorPolicy, MutationFetchPolicy } from "./watchQueryOptions.js";

export const IGNORE = {} as IgnoreModifier;

export class MutationRequest<
  TData,
  TVariables extends OperationVariables,
  TCache extends Cache.Implementation,
> {
  readonly options: ApolloClient.MutateOptions<TData, TVariables, TCache>;
  readonly awaitRefetchQueries: boolean;
  readonly context: DefaultContext | undefined;
  readonly errorPolicy: ErrorPolicy;
  readonly fetchPolicy: MutationFetchPolicy;
  readonly keepRootFields: boolean | undefined;
  readonly onQueryUpdated: typeof this.options.onQueryUpdated;
  readonly refetchQueries: typeof this.options.refetchQueries;
  readonly update: typeof this.options.update;
  readonly updateQueries: typeof this.options.updateQueries;

  mutation: TypedDocumentNode<TData, TVariables>;
  variables: TVariables;

  constructor(options: ApolloClient.MutateOptions<TData, TVariables, TCache>) {
    const {
      mutation,
      awaitRefetchQueries = false,
      context,
      errorPolicy = "none",
      fetchPolicy = "network-only",
      keepRootFields,
      onQueryUpdated,
      refetchQueries = [],
      update,
      updateQueries,
      variables = {} as TVariables,
    } = options;

    this.options = options;
    this.awaitRefetchQueries = awaitRefetchQueries;
    this.context = context;
    this.errorPolicy = errorPolicy;
    this.fetchPolicy = fetchPolicy;
    this.keepRootFields = keepRootFields;
    this.onQueryUpdated = onQueryUpdated;
    this.mutation = mutation;
    this.variables = variables;
    this.updateQueries = updateQueries;
    this.update = update;
    this.refetchQueries = refetchQueries;
  }

  get optimisticResponse() {
    return this.options.optimisticResponse;
  }

  get cacheWriteBehavior() {
    return this.fetchPolicy === "no-cache" ?
        CacheWriteBehavior.FORBID
      : CacheWriteBehavior.MERGE;
  }

  getOptimisticResponse() {
    if (!this.optimisticResponse) {
      return IGNORE;
    }

    if (typeof this.optimisticResponse === "function") {
      return (this.optimisticResponse as any)(this.variables, { IGNORE });
    }

    return this.optimisticResponse;
  }
}
