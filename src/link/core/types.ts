import type { FormattedExecutionResult, GraphQLFormattedError } from "graphql";
import type { DocumentNode } from "graphql";
import type { Observable } from "rxjs";

import type { ApolloClient, DefaultContext } from "@apollo/client";

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

export interface GraphQLRequest<TVariables = Record<string, any>> {
  query: DocumentNode;
  variables?: TVariables;
  operationName?: string;
  context?: DefaultContext;
  extensions?: Record<string, any>;
}

export interface Operation {
  query: DocumentNode;
  variables: Record<string, any>;
  operationName: string;
  extensions: Record<string, any>;
  setContext: {
    (context: Partial<OperationContext>): void;
    (
      updateContext: (
        previousContext: OperationContext
      ) => Partial<OperationContext>
    ): void;
  };
  getContext: () => OperationContext;
  readonly client: ApolloClient;
}

export interface ExecuteContext {
  client: ApolloClient;
}

export interface OperationContext extends DefaultContext {}

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

export type NextLink = (operation: Operation) => Observable<FetchResult>;

export type RequestHandler = (
  operation: Operation,
  forward: NextLink
) => Observable<FetchResult> | null;
