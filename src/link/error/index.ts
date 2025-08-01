import type { Subscription } from "rxjs";
import { Observable } from "rxjs";

import type { ErrorLike } from "@apollo/client";
import {
  CombinedGraphQLErrors,
  graphQLResultHasProtocolErrors,
  PROTOCOL_ERRORS_SYMBOL,
  toErrorLike,
} from "@apollo/client/errors";
import { ApolloLink } from "@apollo/client/link";

export declare namespace ErrorLink {
  /**
   * Callback to be triggered when an error occurs within the link stack.
   */
  export interface ErrorHandler {
    (options: ErrorHandlerOptions): Observable<ApolloLink.Result> | void;
  }

  export interface ErrorHandlerOptions {
    /**
     * The error that occurred during the operation execution. This can be a
     * `CombinedGraphQLErrors` instance (for GraphQL errors) or another error
     * type (for network errors).
     *
     * Use `CombinedGraphQLErrors.is(error)` to check if it's a GraphQL error with an `errors` array.
     */
    error: ErrorLike;
    /**
     * The raw GraphQL result from the server (if available), which may include
     * partial data alongside errors.
     */
    result?: ApolloLink.Result;

    /** The details of the GraphQL operation that produced an error. */
    operation: ApolloLink.Operation;

    /**
     * A function that calls the next link in the link chain. Calling
     * `return forward(operation)` in your `ErrorLink` callback
     * [retries the operation](../../data/error-handling#retrying-operations), returning a new observable for the
     * upstream link to subscribe to.
     */
    forward: ApolloLink.ForwardFunction;
  }
}

// For backwards compatibility.
export import ErrorHandler = ErrorLink.ErrorHandler;

/**
 * @deprecated
 * Use `ErrorLink` from `@apollo/client/link/error` instead.
 */
export function onError(errorHandler: ErrorHandler) {
  return new ErrorLink(errorHandler);
}

export class ErrorLink extends ApolloLink {
  constructor(errorHandler: ErrorLink.ErrorHandler) {
    super((operation, forward) => {
      return new Observable((observer) => {
        let sub: Subscription | undefined;
        let retriedSub: Subscription | undefined;
        let retriedResult: ReturnType<ErrorHandler>;

        try {
          sub = forward(operation).subscribe({
            next: (result) => {
              const handler =
                operation.client["queryManager"].incrementalHandler;
              const errors =
                handler.isIncrementalResult(result) ?
                  handler.extractErrors(result)
                : result.errors;
              if (errors) {
                retriedResult = errorHandler({
                  error: new CombinedGraphQLErrors(result, errors),
                  result,
                  operation,
                  forward,
                });
              } else if (graphQLResultHasProtocolErrors(result)) {
                retriedResult = errorHandler({
                  error: result.extensions[PROTOCOL_ERRORS_SYMBOL],
                  result,
                  operation,
                  forward,
                });
              }

              retriedSub = retriedResult?.subscribe(observer);

              if (!retriedSub) {
                observer.next(result);
              }
            },
            error: (error) => {
              retriedResult = errorHandler({
                operation,
                error: toErrorLike(error),
                forward,
              });
              retriedSub = retriedResult?.subscribe(observer);

              if (!retriedSub) {
                observer.error(error);
              }
            },
            complete: () => {
              // disable the previous sub from calling complete on observable
              // if retry is in flight.
              if (!retriedResult) {
                observer.complete();
              }
            },
          });
        } catch (e) {
          errorHandler({ error: toErrorLike(e), operation, forward });
          observer.error(e);
        }

        return () => {
          if (sub) sub.unsubscribe();
          if (retriedSub) retriedSub.unsubscribe();
        };
      });
    });
  }
}
