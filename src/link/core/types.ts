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

/**
 * The input object used to `execute` a GraphQL request against the link chain.
 */
export interface GraphQLRequest {
  /**
   * The parsed GraphQL document that will be sent with the GraphQL request to
   * the server.
   */
  query: DocumentNode;

  /**
   * The variables provided for the query.
   */
  variables?: OperationVariables;

  /**
   * The string name of the GraphQL operation.
   */
  operationName?: string;

  /**
   * The type of the GraphQL operation, such as query or mutation.
   */
  operationType?: OperationTypeNode;

  /**
   * Context provided to the link chain. Context is not sent to the server and
   * is used to communicate additional metadata from a request to individual
   * links in the link chain.
   */
  context?: DefaultContext;

  /**
   * A map of extensions that will be sent with the GraphQL request to the
   * server.
   */
  extensions?: Record<string, any>;
}

/**
 * The currently executed operation object provided to a `RequestHandler` for
 * each link in the link chain.
 */
export interface Operation {
  /**
   * A `DocumentNode` that describes the operation taking place.
   */
  query: DocumentNode;

  /**
   * A map of GraphQL variables being sent with the operation.
   */
  variables: OperationVariables;

  /**
   * The string name of the GraphQL operation. If it is anonymous,
   * `operationName` will be `undefined`.
   */
  operationName: string | undefined;

  /**
   * The type of the GraphQL operation, such as query or mutation.
   */
  operationType: OperationTypeNode;

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
  getContext: () => Readonly<OperationContext>;

  /**
   * The Apollo Client instance executing the request.
   */
  readonly client: ApolloClient;
}

export interface ExecuteContext {
  /**
   * The Apollo Client instance that executed the GraphQL request.
   */
  client: ApolloClient;
}

/**
 * The `context` object that can be read and modified by links using the
 * `operation.getContext()` and `operation.setContext()` methods.
 */
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

/** {@inheritDoc @apollo/client/link!ApolloLink.DocumentationTypes.RequestHandler:function(1)} */
export type RequestHandler = (
  operation: Operation,
  forward: NextLink
) => Observable<FetchResult> | null;
