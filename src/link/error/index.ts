import type { Subscription } from "rxjs";
import { Observable } from "rxjs";

import type { ErrorLike } from "@apollo/client";
import {
  CombinedGraphQLErrors,
  graphQLResultHasProtocolErrors,
  PROTOCOL_ERRORS_SYMBOL,
  toErrorLike,
} from "@apollo/client/errors";
import type { FetchResult, NextLink, Operation } from "@apollo/client/link";
import { ApolloLink } from "@apollo/client/link";

export namespace ErrorLink {
  /**
   * Callback to be triggered when an error occurs within the link stack.
   */
  export interface ErrorHandler {
    (error: ErrorHandlerOptions): Observable<FetchResult> | void;
  }

  export interface ErrorHandlerOptions {
    /**
     * Error that caused the callback to be triggered.
     */
    error: ErrorLike;
    result?: FetchResult;
    operation: Operation;
    forward: NextLink;
  }
}

// For backwards compatibility.
export import ErrorHandler = ErrorLink.ErrorHandler;

export function onError(errorHandler: ErrorHandler): ApolloLink {
  return new ApolloLink((operation, forward) => {
    return new Observable((observer) => {
      let sub: Subscription | undefined;
      let retriedSub: Subscription | undefined;
      let retriedResult: ReturnType<ErrorHandler>;

      try {
        sub = forward(operation).subscribe({
          next: (result) => {
            const handler = operation.client["queryManager"].incrementalHandler;
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

export class ErrorLink extends ApolloLink {
  private link: ApolloLink;
  constructor(errorHandler: ErrorLink.ErrorHandler) {
    super();
    this.link = onError(errorHandler);
  }

  public request(
    operation: Operation,
    forward: NextLink
  ): Observable<FetchResult> | null {
    return this.link.request(operation, forward);
  }
}
