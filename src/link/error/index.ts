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
  // Using a different namespace name to avoid clash with
  // `ApolloLink.DocumentationTypes`
  export namespace ErrorLinkDocumentationTypes {
    /**
     * Callback that is called by `ErrorLink` when an error occurs from a
     * downstream link in link chain.
     *
     * @param options - The options object provided by `ErrorLink` to the error
     * handler when an error occurs.
     */
    export function ErrorHandler(
      options: ErrorHandlerOptions
    ): Observable<ApolloLink.Result> | void;
  }

  /** {@inheritDoc @apollo/client/link/error!ErrorLink.ErrorLinkDocumentationTypes.ErrorHandler:function(1)} */
  export interface ErrorHandler {
    (options: ErrorHandlerOptions): Observable<ApolloLink.Result> | void;
  }

  /**
   * The object provided to the `ErrorHandler` callback function.
   */
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

/**
 * @deprecated
 * Use `ErrorLink` from `@apollo/client/link/error` instead.
 */
export function onError(errorHandler: ErrorLink.ErrorHandler) {
  return new ErrorLink(errorHandler);
}

/**
 * Use the `ErrorLink` to perform custom logic when a [GraphQL or network error](https://apollographql.com/docs/react/data/error-handling)
 * occurs.
 *
 * @remarks
 *
 * This link is used after the GraphQL operation completes and execution is
 * moving back up your [link chain](https://apollographql.com/docs/react/api/link/introduction#handling-a-response). The `errorHandler` function should
 * not return a value unless you want to [retry the operation](https://apollographql.com/docs/react/data/error-handling#retrying-operations).
 *
 * For more information on the types of errors that might be encountered, see
 * the guide on [error handling](https://apollographql.com/docs/react/data/error-handling).
 *
 * @example
 *
 * ```ts
 * import { ErrorLink } from "@apollo/client/link/error";
 * import {
 *   CombinedGraphQLErrors,
 *   CombinedProtocolErrors,
 * } from "@apollo/client/errors";
 *
 * // Log any GraphQL errors, protocol errors, or network error that occurred
 * const errorLink = new ErrorLink(({ error, operation }) => {
 *   if (CombinedGraphQLErrors.is(error)) {
 *     error.errors.forEach(({ message, locations, path }) =>
 *       console.log(
 *         `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
 *       )
 *     );
 *   } else if (CombinedProtocolErrors.is(error)) {
 *     error.errors.forEach(({ message, extensions }) =>
 *       console.log(
 *         `[Protocol error]: Message: ${message}, Extensions: ${JSON.stringify(
 *           extensions
 *         )}`
 *       )
 *     );
 *   } else {
 *     console.error(`[Network error]: ${error}`);
 *   }
 * });
 * ```
 */
export class ErrorLink extends ApolloLink {
  constructor(errorHandler: ErrorLink.ErrorHandler) {
    super((operation, forward) => {
      return new Observable((observer) => {
        let sub: Subscription | undefined;
        let retriedSub: Subscription | undefined;
        let retriedResult: ReturnType<ErrorLink.ErrorHandler>;

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
