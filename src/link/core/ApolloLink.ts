import type {
  DocumentNode,
  FormattedExecutionResult,
  OperationTypeNode,
} from "graphql";
import type { Observable } from "rxjs";
import { EMPTY } from "rxjs";

import type {
  ApolloClient,
  DefaultContext,
  OperationVariables,
} from "@apollo/client";
import type { TypeOverrides } from "@apollo/client";
import type { NotImplementedHandler } from "@apollo/client/incremental";
import { createOperation } from "@apollo/client/link/utils";
import { __DEV__ } from "@apollo/client/utilities/environment";
import type { ApplyHKTImplementationWithDefault } from "@apollo/client/utilities/internal";
import {
  invariant,
  newInvariantError,
} from "@apollo/client/utilities/invariant";

export declare namespace ApolloLink {
  /**
   * Context provided for link execution, such as the client executing the
   * request. It is separate from the request operation context.
   */
  export interface ExecuteContext {
    /**
     * The Apollo Client instance that executed the GraphQL request.
     */
    client: ApolloClient;
  }

  /** {@inheritDoc @apollo/client/link!ApolloLink.DocumentationTypes.ForwardFunction:function(1)} */
  export type ForwardFunction = (
    operation: ApolloLink.Operation
  ) => Observable<ApolloLink.Result>;

  /**
   * The input object provided to `ApolloLink.execute` to send a GraphQL request through
   * the link chain.
   */
  export interface Request {
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

  /** {@inheritDoc @apollo/client/link!ApolloLink.DocumentationTypes.RequestHandler:function(1)} */
  export type RequestHandler = (
    operation: ApolloLink.Operation,
    forward: ApolloLink.ForwardFunction
  ) => Observable<ApolloLink.Result>;

  export type AdditionalResultTypes<
    TData = Record<string, any>,
    TExtensions = Record<string, any>,
  > = ApplyHKTImplementationWithDefault<
    TypeOverrides,
    "AdditionalApolloLinkResultTypes",
    NotImplementedHandler.TypeOverrides,
    TData,
    TExtensions
  >;

  export type Result<
    TData = Record<string, any>,
    TExtensions = Record<string, any>,
  > =
    | FormattedExecutionResult<TData, TExtensions>
    | AdditionalResultTypes<TData, TExtensions>;

  /**
   * The currently executed operation object provided to an `ApolloLink.RequestHandler`
   * for each link in the link chain.
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
      (context: Partial<ApolloLink.OperationContext>): void;
      (
        updateContext: (
          previousContext: Readonly<ApolloLink.OperationContext>
        ) => Partial<ApolloLink.OperationContext>
      ): void;
    };

    /**
     * A function that gets the current context of the request. This can be used
     * by links to determine which actions to perform. See [managing context](https://apollographql.com/docs/react/api/link/introduction#managing-context)
     */
    getContext: () => Readonly<ApolloLink.OperationContext>;

    /**
     * The Apollo Client instance executing the request.
     */
    readonly client: ApolloClient;
  }

  /**
   * The `context` object that can be read and modified by links using the
   * `operation.getContext()` and `operation.setContext()` methods.
   */
  export interface OperationContext extends DefaultContext {}

  export namespace DocumentationTypes {
    /**
     * A request handler is responsible for performing some logic and executing the
     * request, either by [forwarding](https://apollographql.com/docs/react/api/link/introduction#the-request-handler) the operation to the next link in the
     * chain, or sending the operation to the destination that executes it, such as
     * a GraphQL server.
     *
     * @param operation - The `Operation` object that provides information about the
     * currently executed GraphQL request.
     *
     * @param forward - A function that is called to execute the next link in the
     * chain.
     */
    export function RequestHandler(
      operation: ApolloLink.Operation,
      forward: ApolloLink.ForwardFunction
    ): Observable<ApolloLink.Result>;

    /**
     * A function that when called will execute the next link in the link chain.
     *
     * @example
     *
     * ```ts
     * const link = new ApolloLink((operation, forward) => {
     *   // process the request
     *
     *   // Call `forward` to execute the next link in the chain
     *   return forward(operation);
     * });
     * ```
     *
     * @param operation - The current `ApolloLink.Operation` object for the
     * request.
     */
    export function ForwardFunction(
      operation: ApolloLink.Operation
    ): Observable<ApolloLink.Result>;
  }
}

/**
 * The base class for all links in Apollo Client. A link represents either a
 * self-contained modification to a GraphQL operation or a side effect (such as
 * logging).
 *
 * @remarks
 *
 * Links enable you to customize Apollo Client's request flow by composing
 * together different pieces of functionality into a chain of links. Each
 * link represents a specific capability, such as adding authentication headers,
 * retrying failed requests, batching operations, or sending requests to a
 * GraphQL server.
 *
 * Every link must define a request handler via its constructor or by extending
 * this class and implementing the `request` method.
 *
 * @example
 *
 * ```ts
 * import { ApolloLink } from "@apollo/client";
 *
 * const link = new ApolloLink((operation, forward) => {
 *   console.log("Operation:", operation.operationName);
 *   return forward(operation);
 * });
 * ```
 */
export class ApolloLink {
  /**
   * Creates a link that completes immediately and does not emit a result.
   *
   * @example
   *
   * ```ts
   * const link = ApolloLink.empty();
   * ```
   */
  public static empty(): ApolloLink {
    return new ApolloLink(() => EMPTY);
  }

  /**
   * Composes multiple links into a single composed link that executes each
   * provided link in serial order.
   *
   * @example
   *
   * ```ts
   * import { from, HttpLink, ApolloLink } from "@apollo/client";
   * import { RetryLink } from "@apollo/client/link/retry";
   * import MyAuthLink from "../auth";
   *
   * const link = ApolloLink.from([
   *   new RetryLink(),
   *   new MyAuthLink(),
   *   new HttpLink({ uri: "http://localhost:4000/graphql" }),
   * ]);
   * ```
   *
   * @param links - An array of `ApolloLink` instances or request handlers that
   * are executed in serial order.
   */
  public static from(links: ApolloLink[]): ApolloLink {
    if (links.length === 0) return ApolloLink.empty();

    const [first, ...rest] = links;
    return first.concat(...rest);
  }

  /**
   * Creates a link that conditionally routes a request to different links.
   *
   * @example
   *
   * ```ts
   * import { ApolloLink, HttpLink } from "@apollo/client";
   *
   * const link = ApolloLink.split(
   *   (operation) => operation.getContext().version === 1,
   *   new HttpLink({ uri: "http://localhost:4000/v1/graphql" }),
   *   new HttpLink({ uri: "http://localhost:4000/v2/graphql" })
   * );
   * ```
   *
   * @param test - A predicate function that receives the current `operation`
   * and returns a boolean indicating which link to execute. Returning `true`
   * executes the `left` link. Returning `false` executes the `right` link.
   *
   * @param left - The link that executes when the `test` function returns
   * `true`.
   *
   * @param right - The link that executes when the `test` function returns
   * `false`. If the `right` link is not provided, the request is forwarded to
   * the next link in the chain.
   */
  public static split(
    test: (op: ApolloLink.Operation) => boolean,
    left: ApolloLink,
    right: ApolloLink = new ApolloLink((op, forward) => forward(op))
  ): ApolloLink {
    const link = new ApolloLink((operation, forward) => {
      const result = test(operation);

      if (__DEV__) {
        if (typeof result !== "boolean") {
          invariant.warn(
            "[ApolloLink.split]: The test function returned a non-boolean value which could result in subtle bugs (e.g. such as using an `async` function which always returns a truthy value). Got `%o`.",
            result
          );
        }
      }

      return result ?
          left.request(operation, forward)
        : right.request(operation, forward);
    });
    return Object.assign(link, { left, right });
  }

  /**
   * Executes a GraphQL request against a link. The `execute` function begins
   * the request by calling the request handler of the link.
   *
   * @example
   *
   * ```ts
   * const observable = ApolloLink.execute(link, { query, variables }, { client });
   *
   * observable.subscribe({
   *   next(value) {
   *     console.log("Received", value);
   *   },
   *   error(error) {
   *     console.error("Oops got error", error);
   *   },
   *   complete() {
   *     console.log("Request complete");
   *   },
   * });
   * ```
   *
   * @param link - The `ApolloLink` instance to execute the request.
   *
   * @param request - The GraphQL request details, such as the `query` and
   * `variables`.
   *
   * @param context - The execution context for the request, such as the
   * `client` making the request.
   */
  public static execute(
    link: ApolloLink,
    request: ApolloLink.Request,
    context: ApolloLink.ExecuteContext
  ): Observable<ApolloLink.Result> {
    return link.request(createOperation(request, context), () => {
      if (__DEV__) {
        invariant.warn(
          "The terminating link provided to `ApolloLink.execute` called `forward` instead of handling the request. " +
            "This results in an observable that immediately completes and does not emit a value. " +
            "Please provide a terminating link that properly handles the request.\n\n" +
            "If you are using a split link, ensure each branch contains a terminating link that handles the request."
        );
      }
      return EMPTY;
    });
  }

  /**
   * Combines multiple links into a single composed link.
   *
   * @example
   *
   * ```ts
   * const link = ApolloLink.concat(firstLink, secondLink, thirdLink);
   * ```
   *
   * @param links - The links to concatenate into a single link. Each link will
   * execute in serial order.
   *
   * @deprecated Use `ApolloLink.from` instead. `ApolloLink.concat` will be
   * removed in a future major version.
   */
  public static concat(...links: ApolloLink[]) {
    return ApolloLink.from(links);
  }

  constructor(request?: ApolloLink.RequestHandler) {
    if (request) this.request = request;
  }

  /**
   * Concatenates a link that conditionally routes a request to different links.
   *
   * @example
   *
   * ```ts
   * import { ApolloLink, HttpLink } from "@apollo/client";
   *
   * const previousLink = new ApolloLink((operation, forward) => {
   *   // Handle the request
   *
   *   return forward(operation);
   * });
   *
   * const link = previousLink.split(
   *   (operation) => operation.getContext().version === 1,
   *   new HttpLink({ uri: "http://localhost:4000/v1/graphql" }),
   *   new HttpLink({ uri: "http://localhost:4000/v2/graphql" })
   * );
   * ```
   *
   * @param test - A predicate function that receives the current `operation`
   * and returns a boolean indicating which link to execute. Returning `true`
   * executes the `left` link. Returning `false` executes the `right` link.
   *
   * @param left - The link that executes when the `test` function returns
   * `true`.
   *
   * @param right - The link that executes when the `test` function returns
   * `false`. If the `right` link is not provided, the request is forwarded to
   * the next link in the chain.
   */
  public split(
    test: (op: ApolloLink.Operation) => boolean,
    left: ApolloLink,
    right?: ApolloLink
  ): ApolloLink {
    return this.concat(ApolloLink.split(test, left, right));
  }

  /**
   * Combines the link with other links into a single composed link.
   *
   * @example
   *
   * ```ts
   * import { ApolloLink, HttpLink } from "@apollo/client";
   *
   * const previousLink = new ApolloLink((operation, forward) => {
   *   // Handle the request
   *
   *   return forward(operation);
   * });
   *
   * const link = previousLink.concat(
   *   link1,
   *   link2,
   *   new HttpLink({ uri: "http://localhost:4000/graphql" })
   * );
   * ```
   */
  public concat(...links: ApolloLink[]): ApolloLink {
    if (links.length === 0) {
      return this;
    }

    return links.reduce(this.combine.bind(this), this);
  }

  private combine(left: ApolloLink, right: ApolloLink) {
    const link = new ApolloLink((operation, forward) => {
      return left.request(operation, (op) => right.request(op, forward));
    });

    return Object.assign(link, { left, right });
  }

  /**
   * Runs the request handler for the provided operation.
   *
   * > [!NOTE]
   * > This is called by the `ApolloLink.execute` function for you and should
   * > not be called directly. Prefer using `ApolloLink.execute` to make the
   * > request instead.
   */
  public request(
    operation: ApolloLink.Operation,
    forward: ApolloLink.ForwardFunction
  ): Observable<ApolloLink.Result> {
    throw newInvariantError("request is not implemented");
  }

  /**
   * @internal
   * Used to iterate through all links that are concatenations or `split` links.
   */
  readonly left?: ApolloLink;
  /**
   * @internal
   * Used to iterate through all links that are concatenations or `split` links.
   */
  readonly right?: ApolloLink;

  /**
   * @internal
   * Can be provided by a link that has an internal cache to report it's memory details.
   */
  declare getMemoryInternals?: () => unknown;
}
