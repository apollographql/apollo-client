import { Observable, throwError } from "rxjs";

import { ApolloLink } from "@apollo/client/link";
import { BatchLink } from "@apollo/client/link/batch";
import { ClientAwarenessLink } from "@apollo/client/link/client-awareness";
import type { HttpLink } from "@apollo/client/link/http";
import {
  checkFetcher,
  defaultPrinter,
  fallbackHttpConfig,
  parseAndCheckHttpResponse,
  selectHttpOptionsAndBodyInternal,
  selectURI,
} from "@apollo/client/link/http";
import { filterOperationVariables } from "@apollo/client/link/utils";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { compact } from "@apollo/client/utilities/internal";
import { maybe } from "@apollo/client/utilities/internal/globals";

export declare namespace BatchHttpLink {
  /**
   * Options provided to the `BatchHttpLink` constructor.
   */
  export interface Options
    extends Pick<
        BatchLink.Options,
        "batchMax" | "batchDebounce" | "batchInterval" | "batchKey"
      >,
      Omit<HttpLink.Options, "useGETForQueries"> {}

  /**
   * Options passed to `BatchHttpLink` through [request context](https://apollographql.com/docs/react/api/link/introduction#managing-context). Previous
   * non-terminating links in the link chain also can set these values to
   * customize the behavior of `BatchHttpLink` for each operation.
   *
   * > [!NOTE]
   * > Some of these values can also be provided to the `BatchHttpLink` constructor.
   * > If a value is provided to both, the value in `context` takes precedence.
   */
  export interface ContextOptions extends HttpLink.ContextOptions {}
}

const backupFetch = maybe(() => fetch);

/**
 * `BatchHttpLink` is a terminating link that batches array of individual
 * GraphQL operations into a single HTTP request that's sent to a single GraphQL
 * endpoint. It combines the functionality of `BaseBatchHttpLink` and
 * `ClientAwarenessLink` into a single link.
 *
 * @remarks
 *
 * If you use `BatchHttpLink` instead of `HttpLink` as your terminating link,
 * Apollo Client automatically batches executed GraphQL operations and transmits
 * them to your server according to the batching options you provide.
 *
 * @example
 *
 * ```ts
 * import { BatchHttpLink } from "@apollo/client/link/batch-http";
 *
 * const link = new BatchHttpLink({
 *   uri: "http://localhost:4000/graphql",
 *   batchMax: 5, // No more than 5 operations per batch
 *   batchInterval: 20, // Wait no more than 20ms after first batched operation
 * });
 * ```
 */
export class BatchHttpLink extends ApolloLink {
  constructor(
    options: BatchHttpLink.Options & ClientAwarenessLink.Options = {}
  ) {
    const { left, right, request } = ApolloLink.from([
      new ClientAwarenessLink(options),
      new BaseBatchHttpLink(options),
    ]);
    super(request);
    Object.assign(this, { left, right });
  }
}
export class BaseBatchHttpLink extends ApolloLink {
  private batchDebounce?: boolean;
  private batchInterval: number;
  private batchMax: number;
  private batcher: ApolloLink;

  constructor(fetchParams?: BatchHttpLink.Options) {
    super();

    let {
      uri = "/graphql",
      // use default global fetch if nothing is passed in
      fetch: preferredFetch,
      print = defaultPrinter,
      includeExtensions,
      preserveHeaderCase,
      batchInterval,
      batchDebounce,
      batchMax,
      batchKey,
      includeUnusedVariables = false,
      ...requestOptions
    } = fetchParams || ({} as BatchHttpLink.Options);

    if (__DEV__) {
      // Make sure at least one of preferredFetch, window.fetch, or backupFetch
      // is defined, so requests won't fail at runtime.
      checkFetcher(preferredFetch || backupFetch);
    }

    const linkConfig = {
      http: compact({ includeExtensions, preserveHeaderCase }),
      options: requestOptions.fetchOptions,
      credentials: requestOptions.credentials,
      headers: requestOptions.headers,
    };

    this.batchDebounce = batchDebounce;
    this.batchInterval = batchInterval || 10;
    this.batchMax = batchMax || 10;

    const batchHandler: BatchLink.BatchHandler = (operations) => {
      const chosenURI = selectURI(operations[0], uri);

      const context = operations[0].getContext();

      const contextConfig = {
        http: context.http,
        options: context.fetchOptions,
        credentials: context.credentials,
        headers: context.headers,
      };

      //uses fallback, link, and then context to build options
      const optsAndBody = operations.map((operation) => {
        const result = selectHttpOptionsAndBodyInternal(
          operation,
          print,
          fallbackHttpConfig,
          linkConfig,
          contextConfig
        );

        if (result.body.variables && !includeUnusedVariables) {
          result.body.variables = filterOperationVariables(
            result.body.variables,
            operation.query
          );
        }

        return result;
      });

      const loadedBody = optsAndBody.map(({ body }) => body);
      const options = optsAndBody[0].options;

      // There's no spec for using GET with batches.
      if (options.method === "GET") {
        return throwError(
          () =>
            new Error("apollo-link-batch-http does not support GET requests")
        );
      }

      try {
        (options as any).body = JSON.stringify(loadedBody);
      } catch (parseError) {
        return throwError(() => parseError);
      }

      let controller: AbortController | undefined;
      if (!options.signal && typeof AbortController !== "undefined") {
        controller = new AbortController();
        options.signal = controller.signal;
      }

      return new Observable((observer) => {
        // Prefer BatchHttpLink.Options.fetch (preferredFetch) if provided, and
        // otherwise fall back to the *current* global window.fetch function
        // (see issue #7832), or (if all else fails) the backupFetch function we
        // saved when this module was first evaluated. This last option protects
        // against the removal of window.fetch, which is unlikely but not
        // impossible.
        const currentFetch =
          preferredFetch || maybe(() => fetch) || backupFetch;

        currentFetch!(chosenURI, options)
          .then((response) => {
            // Make the raw response available in the context.
            operations.forEach((operation) =>
              operation.setContext({ response })
            );
            return response;
          })
          .then(parseAndCheckHttpResponse(operations))
          .then((result) => {
            controller = undefined;
            // we have data and can send it to back up the link chain
            observer.next(result);
            observer.complete();
            return result;
          })
          .catch((err) => {
            controller = undefined;
            observer.error(err);
          });

        return () => {
          // XXX support canceling this request
          // https://developers.google.com/web/updates/2017/09/abortable-fetch
          if (controller) controller.abort();
        };
      });
    };

    batchKey =
      batchKey ||
      ((operation: ApolloLink.Operation) => {
        const context = operation.getContext();

        const contextConfig = {
          http: context.http,
          options: context.fetchOptions,
          credentials: context.credentials,
          headers: context.headers,
        };

        //may throw error if config not serializable
        return selectURI(operation, uri) + JSON.stringify(contextConfig);
      });

    this.batcher = new BatchLink({
      batchDebounce: this.batchDebounce,
      batchInterval: this.batchInterval,
      batchMax: this.batchMax,
      batchKey,
      batchHandler,
    });
  }

  public request(
    operation: ApolloLink.Operation,
    forward: ApolloLink.ForwardFunction
  ): Observable<ApolloLink.Result> {
    return this.batcher.request(operation, forward);
  }
}
