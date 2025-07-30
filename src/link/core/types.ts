import type { FormattedExecutionResult, GraphQLFormattedError } from "graphql";
import type { DocumentNode } from "graphql";
import type { Observable } from "rxjs";

import type { ApolloClient } from "@apollo/client";

import type { ApolloLink } from "./ApolloLink.js";

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

export interface ExecuteContext {
  /**
   * The Apollo Client instance that executed the GraphQL request.
   */
  client: ApolloClient;
}

export type FetchResult<
  TData = Record<string, any>,
  TExtensions = Record<string, any>,
> =
  | FormattedExecutionResult<TData, TExtensions>
  | AdditionalFetchResultTypes<
      TData,
      TExtensions
    >[keyof AdditionalFetchResultTypes<TData, TExtensions>];

export interface AdditionalFetchResultTypes<
  TData = Record<string, any>,
  TExtensions = Record<string, any>,
> {}

/** {@inheritDoc @apollo/client/link!ApolloLink.DocumentationTypes.RequestHandler:function(1)} */
export type RequestHandler = (
  operation: ApolloLink.Operation,
  forward: ApolloLink.ForwardFunction
) => Observable<FetchResult> | null;
