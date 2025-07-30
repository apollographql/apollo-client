import type { FormattedExecutionResult, GraphQLFormattedError } from "graphql";
import type { DocumentNode } from "graphql";

export type { DocumentNode };

export interface ApolloPayloadResult<
  TData = Record<string, any>,
  TExtensions = Record<string, any>,
> {
  payload: FormattedExecutionResult<TData, TExtensions> | null;
  // Transport layer errors (as distinct from GraphQL or NetworkErrors),
  // these are fatal errors that will include done: true.
  errors?: ReadonlyArray<GraphQLFormattedError>;
}

export interface AdditionalApolloLinkResultTypes<
  TData = Record<string, any>,
  TExtensions = Record<string, any>,
> {}
