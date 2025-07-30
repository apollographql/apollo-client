import type { Observable } from "rxjs";
import { EMPTY } from "rxjs";

import { createOperation } from "@apollo/client/link/utils";
import {
  invariant,
  newInvariantError,
} from "@apollo/client/utilities/invariant";

import type {
  ExecuteContext,
  FetchResult,
  ForwardFunction,
  GraphQLRequest,
  Operation,
  RequestHandler,
} from "./types.js";

function passthrough(op: Operation, forward: ForwardFunction) {
  return (forward ? forward(op) : EMPTY) as Observable<FetchResult>;
}

function toLink(handler: RequestHandler | ApolloLink) {
  return typeof handler === "function" ? new ApolloLink(handler) : handler;
}

function isTerminating(link: ApolloLink): boolean {
  return link.request.length <= 1;
}

export declare namespace ApolloLink {
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
      operation: Operation,
      forward: ForwardFunction
    ): Observable<FetchResult> | null;
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
   * Creates a link that does not emit a result and immediately completes.
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
  public static from(links: (ApolloLink | RequestHandler)[]): ApolloLink {
    if (links.length === 0) return ApolloLink.empty();
    return links.map(toLink).reduce((x, y) => x.concat(y)) as ApolloLink;
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
    test: (op: Operation) => boolean,
    left: ApolloLink | RequestHandler,
    right?: ApolloLink | RequestHandler
  ): ApolloLink {
    const leftLink = toLink(left);
    const rightLink = toLink(right || new ApolloLink(passthrough));

    let ret: ApolloLink;
    if (isTerminating(leftLink) && isTerminating(rightLink)) {
      ret = new ApolloLink((operation) => {
        return test(operation) ?
            leftLink.request(operation) || EMPTY
          : rightLink.request(operation) || EMPTY;
      });
    } else {
      ret = new ApolloLink((operation, forward) => {
        return test(operation) ?
            leftLink.request(operation, forward) || EMPTY
          : rightLink.request(operation, forward) || EMPTY;
      });
    }
    return Object.assign(ret, { left: leftLink, right: rightLink });
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
    request: GraphQLRequest,
    context: ExecuteContext
  ): Observable<FetchResult> {
    return link.request(createOperation(request, context)) || EMPTY;
  }

  /**
   * Combines two links into a single composed link.
   *
   * @example
   *
   * ```ts
   * const link = ApolloLink.concat(firstLink, secondLink);
   * ```
   *
   * @param first - The first link or request handler that will execute in the
   * link chain.
   *
   * @param second - The next link or request handler that will execute in the
   * link chain.
   */
  public static concat(
    first: ApolloLink | RequestHandler,
    second: ApolloLink | RequestHandler
  ) {
    const firstLink = toLink(first);
    if (isTerminating(firstLink)) {
      invariant.warn(
        `You are calling concat on a terminating link, which will have no effect %o`,
        firstLink
      );
      return firstLink;
    }
    const nextLink = toLink(second);

    let ret: ApolloLink;
    if (isTerminating(nextLink)) {
      ret = new ApolloLink(
        (operation) =>
          firstLink.request(operation, (op) => nextLink.request(op) || EMPTY) ||
          EMPTY
      );
    } else {
      ret = new ApolloLink((operation, forward) => {
        return (
          firstLink.request(operation, (op) => {
            return nextLink.request(op, forward) || EMPTY;
          }) || EMPTY
        );
      });
    }
    return Object.assign(ret, { left: firstLink, right: nextLink });
  }

  constructor(request?: RequestHandler) {
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
    test: (op: Operation) => boolean,
    left: ApolloLink | RequestHandler,
    right?: ApolloLink | RequestHandler
  ): ApolloLink {
    return this.concat(
      ApolloLink.split(test, left, right || new ApolloLink(passthrough))
    );
  }

  /**
   * Combines the link with another link into a single composed link.
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
   *   new HttpLink({ uri: "http://localhost:4000/graphql" })
   * );
   * ```
   */
  public concat(next: ApolloLink | RequestHandler): ApolloLink {
    return ApolloLink.concat(this, next);
  }

  /**
   * Runs the request handler for the provided operation.
   *
   * > [!NOTE]
   * > This is called by the `execute` function for you and should not be called
   * > directly. Prefer using `ApolloLink.execute` to make the request instead.
   */
  public request(
    operation: Operation,
    forward?: ForwardFunction
  ): Observable<FetchResult> | null {
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
  getMemoryInternals?: () => unknown;
}
