import type { Observable, Subscriber } from "rxjs";
import { EMPTY } from "rxjs";

import {
  createOperation,
  transformOperation,
  validateOperation,
} from "@apollo/client/link/utils";
import {
  invariant,
  newInvariantError,
} from "@apollo/client/utilities/invariant";

import type {
  FetchResult,
  GraphQLRequest,
  NextLink,
  Operation,
  RequestHandler,
} from "./types.js";

function passthrough(op: Operation, forward: NextLink) {
  return (forward ? forward(op) : EMPTY) as Observable<FetchResult>;
}

function toLink(handler: RequestHandler | ApolloLink) {
  return typeof handler === "function" ? new ApolloLink(handler) : handler;
}

function isTerminating(link: ApolloLink): boolean {
  return link.request.length <= 1;
}

export class ApolloLink {
  public static empty(): ApolloLink {
    return new ApolloLink(() => EMPTY);
  }

  public static from(links: (ApolloLink | RequestHandler)[]): ApolloLink {
    if (links.length === 0) return ApolloLink.empty();
    return links.map(toLink).reduce((x, y) => x.concat(y)) as ApolloLink;
  }

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

  public static execute(
    link: ApolloLink,
    operation: GraphQLRequest
  ): Observable<FetchResult> {
    return (
      link.request(
        createOperation(
          operation.context,
          transformOperation(validateOperation(operation))
        )
      ) || EMPTY
    );
  }

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

  public split(
    test: (op: Operation) => boolean,
    left: ApolloLink | RequestHandler,
    right?: ApolloLink | RequestHandler
  ): ApolloLink {
    return this.concat(
      ApolloLink.split(test, left, right || new ApolloLink(passthrough))
    );
  }

  public concat(next: ApolloLink | RequestHandler): ApolloLink {
    return ApolloLink.concat(this, next);
  }

  public request(
    operation: Operation,
    forward?: NextLink
  ): Observable<FetchResult> | null {
    throw newInvariantError("request is not implemented");
  }

  protected onError(
    error: any,
    observer?: Subscriber<FetchResult>
  ): false | void {
    if (observer && observer.error) {
      observer.error(error);
      // Returning false indicates that observer.error does not need to be
      // called again, since it was already called (on the previous line).
      // Calling observer.error again would not cause any real problems,
      // since only the first call matters, but custom onError functions
      // might have other reasons for wanting to prevent the default
      // behavior by returning false.
      return false;
    }
    // Throw errors will be passed to observer.error.
    throw error;
  }

  public setOnError(fn: ApolloLink["onError"]): this {
    this.onError = fn;
    return this;
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
