import { Observable, throwError } from "rxjs";

import type { FetchResult, Operation } from "@apollo/client/link";
import { ApolloLink } from "@apollo/client/link";
import type { BatchHandler } from "@apollo/client/link/batch";
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
  serializeFetchParameter,
} from "@apollo/client/link/http";
import { filterOperationVariables } from "@apollo/client/link/utils";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { compact } from "@apollo/client/utilities/internal";
import { maybe } from "@apollo/client/utilities/internal/globals";

export declare namespace BatchHttpLink {
  export type Options = Pick<
    BatchLink.Options,
    "batchMax" | "batchDebounce" | "batchInterval" | "batchKey"
  > &
    Omit<HttpLink.Options, "useGETForQueries">;

  export type ContextOptions = HttpLink.ContextOptions;
}

const backupFetch = maybe(() => fetch);

/**
 * Transforms Operation for into HTTP results.
 * context can include the headers property, which will be passed to the fetch function
 */
export class BatchHttpLink extends ApolloLink {
  constructor(
    options: BatchHttpLink.Options & ClientAwarenessLink.Options = {}
  ) {
    const { left, right, request } = ApolloLink.concat(
      new ClientAwarenessLink(options),
      new BaseBatchHttpLink(options)
    );
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

    const batchHandler: BatchHandler = (operations) => {
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
        (options as any).body = serializeFetchParameter(loadedBody, "Payload");
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
      ((operation: Operation) => {
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

  public request(operation: Operation): Observable<FetchResult> | null {
    return this.batcher.request(operation);
  }
}
