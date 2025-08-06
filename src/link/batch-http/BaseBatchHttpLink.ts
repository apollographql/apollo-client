import { Observable, throwError } from "rxjs";

import { ApolloLink } from "@apollo/client/link";
import { BatchLink } from "@apollo/client/link/batch";
import type { BaseHttpLink } from "@apollo/client/link/http";
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

export declare namespace BaseBatchHttpLink {
  /**
   * Options passed to `BaseBatchHttpLink` through [request context](https://apollographql.com/docs/react/api/link/introduction#managing-context). Previous
   * non-terminating links in the link chain also can set these values to
   * customize the behavior of `BatchHttpLink` for each operation.
   *
   * > [!NOTE]
   * > Some of these values can also be provided to the `BaseBatchHttpLink` constructor.
   * > If a value is provided to both, the value in `context` takes precedence.
   */
  export interface ContextOptions extends BaseHttpLink.ContextOptions {}
  /**
   * Configuration options for creating a `BaseBatchHttpLink` instance.
   *
   * > [!NOTE]
   * > Some of these options are also available to override in [request context](https://apollographql.com/docs/react/api/link/introduction#managing-context).
   * > Context options override the options passed to the constructor. Treat
   * > these options as default values that are used when the request context
   * > does not override the value.
   */
  interface Options
    extends BatchLink.Shared.Options,
      BaseHttpLink.Shared.Options {
    /** {@inheritDoc @apollo/client/link/batch!BatchLink.Shared.Options#batchMax:member {"defaultValue": 10}} */
    batchMax?: number;
  }
}

const backupFetch = maybe(() => fetch);

/**
 * `BaseBatchHttpLink` is a terminating link that batches array of individual
 * GraphQL operations into a single HTTP request that's sent to a single GraphQL
 * endpoint. It serves as a base link to `BatchHttpLink`.
 *
 * @remarks
 *
 * > [!NOTE]
 * > Prefer using `BatchHttpLink` over `BaseBatchHttpLink`. Use
 * > `BaseBatchHttpLink` when you need to disable client awareness features and
 * > would like to tree-shake the implementation of `ClientAwarenessLink` out
 * > of your app bundle.
 *
 * @example
 *
 * ```ts
 * import { BaseBatchHttpLink } from "@apollo/client/link/batch-http";
 *
 * const link = new BaseBatchHttpLink({
 *   uri: "http://localhost:4000/graphql",
 *   batchMax: 5, // No more than 5 operations per batch
 *   batchInterval: 20, // Wait no more than 20ms after first batched operation
 * });
 * ```
 */
export class BaseBatchHttpLink extends ApolloLink {
  private batchDebounce?: boolean;
  private batchInterval: number;
  private batchMax: number;
  private batcher: ApolloLink;

  constructor(options: BaseBatchHttpLink.Options = {}) {
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
    } = options;

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
