import type { FormattedExecutionResult, GraphQLFormattedError } from "graphql";

import type { NetworkError } from "@apollo/client/errors";
import {
  graphQLResultHasProtocolErrors,
  PROTOCOL_ERRORS_SYMBOL,
} from "@apollo/client/errors";
import type {
  FetchResult,
  NextLink,
  Operation,
} from "@apollo/client/link/core";
import { ApolloLink } from "@apollo/client/link/core";
import { Observable } from "@apollo/client/utilities";

export interface ErrorResponse {
  /**
   * Errors returned in the `errors` property of the GraphQL response.
   */
  graphQLErrors?: ReadonlyArray<GraphQLFormattedError>;
  /**
   * Errors thrown during a network request. This is usually an error thrown
   * during a `fetch` call or an error while parsing the response from the
   * network.
   */
  networkError?: NetworkError;
  /**
   * Fatal transport-level errors from multipart subscriptions.
   * See the [multipart subscription protocol](https://www.apollographql.com/docs/graphos/routing/operations/subscriptions/multipart-protocol#message-and-error-format) for more information.
   */
  protocolErrors?: ReadonlyArray<GraphQLFormattedError>;
  response?: FormattedExecutionResult;
  operation: Operation;
  forward: NextLink;
}

export namespace ErrorLink {
  /**
   * Callback to be triggered when an error occurs within the link stack.
   */
  export interface ErrorHandler {
    (error: ErrorResponse): Observable<FetchResult> | void;
  }
}

// For backwards compatibility.
export import ErrorHandler = ErrorLink.ErrorHandler;

export function onError(errorHandler: ErrorHandler): ApolloLink {
  return new ApolloLink((operation, forward) => {
    return new Observable((observer) => {
      let sub: any;
      let retriedSub: any;
      let retriedResult: any;

      try {
        sub = forward(operation).subscribe({
          next: (result) => {
            if (result.errors) {
              retriedResult = errorHandler({
                graphQLErrors: result.errors,
                response: result,
                operation,
                forward,
              });
            } else if (graphQLResultHasProtocolErrors(result)) {
              retriedResult = errorHandler({
                protocolErrors: result.extensions[PROTOCOL_ERRORS_SYMBOL],
                response: result,
                operation,
                forward,
              });
            }

            if (retriedResult) {
              retriedSub = retriedResult.subscribe({
                next: observer.next.bind(observer),
                error: observer.error.bind(observer),
                complete: observer.complete.bind(observer),
              });
              return;
            }

            observer.next(result);
          },
          error: (networkError) => {
            retriedResult = errorHandler({
              operation,
              networkError,
              //Network errors can return GraphQL errors on for example a 403
              graphQLErrors:
                (networkError &&
                  networkError.result &&
                  networkError.result.errors) ||
                void 0,
              forward,
            });
            if (retriedResult) {
              retriedSub = retriedResult.subscribe({
                next: observer.next.bind(observer),
                error: observer.error.bind(observer),
                complete: observer.complete.bind(observer),
              });
              return;
            }
            observer.error(networkError);
          },
          complete: () => {
            // disable the previous sub from calling complete on observable
            // if retry is in flight.
            if (!retriedResult) {
              observer.complete.bind(observer)();
            }
          },
        });
      } catch (e) {
        errorHandler({ networkError: e as Error, operation, forward });
        observer.error(e);
      }

      return () => {
        if (sub) sub.unsubscribe();
        if (retriedSub) sub.unsubscribe();
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
