import type {
  FormattedExecutionResult,
  GraphQLFormattedError,
  OperationTypeNode,
} from "graphql";
import type { DocumentNode } from "graphql";
import type { Observable } from "rxjs";

import type {
  ApolloClient,
  DefaultContext,
  OperationVariables,
} from "@apollo/client";

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

export interface GraphQLRequest<
  TVariables extends OperationVariables = Record<string, any>,
> {
  query: DocumentNode;
  variables?: TVariables;
  operationName?: string;
  operationType?: OperationTypeNode;
  context?: DefaultContext;
  extensions?: Record<string, any>;
}

export interface Operation {
  /**
   * A `DocumentNode` that describes the operation taking place.
   */
  query: DocumentNode;
  /**
   * A map of GraphQL variables being sent with the operation.
   */
  variables: Record<string, any>;

  /**
   * The string name of the query. If the query is anonymous, `operationName`
   * will be `undefined.
   */
  operationName: string;

  /**
   * The type of the operation, such as query or mutation.
   */
  operationType: OperationTypeNode | undefined;

  /**
   * A map that stores extensions data to be sent to the server.
   */
  extensions: Record<string, any>;

  /**
   * A function that takes either a new context object, or a function which
   * takes in the previous context and returns a new one. See [managing
   * context](https://apollographql.com/docs/react/api/link/introduction#managing-context).
   */
  setContext: {
    (context: Partial<OperationContext>): void;
    (
      updateContext: (
        previousContext: OperationContext
      ) => Partial<OperationContext>
    ): void;
  };

  /**
   * A function that gets the current context of the request. This can be used
   * by links to determine which actions to perform. See [managing context](https://apollographql.com/docs/react/api/link/introduction#managing-context)
   */
  getContext: () => OperationContext;

  /**
   * The Apollo Client instance executing the request.
   */
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
