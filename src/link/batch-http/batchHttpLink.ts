import type { Operation, FetchResult } from "../core/index.js";
import { ApolloLink } from "../core/index.js";
import {
  Observable,
  hasDirectives,
  maybe,
  removeClientSetsFromDocument,
} from "../../utilities/index.js";
import { fromError } from "../utils/index.js";
import type { HttpOptions } from "../http/index.js";
import {
  serializeFetchParameter,
  selectURI,
  parseAndCheckHttpResponse,
  checkFetcher,
  selectHttpOptionsAndBodyInternal,
  defaultPrinter,
  fallbackHttpConfig,
} from "../http/index.js";
import { BatchLink } from "../batch/index.js";
import { filterOperationVariables } from "../utils/filterOperationVariables.js";

export namespace BatchHttpLink {
  export type Options = Pick<
    BatchLink.Options,
    "batchMax" | "batchDebounce" | "batchInterval" | "batchKey"
  > &
    Omit<HttpOptions, "useGETForQueries">;
}

const backupFetch = maybe(() => fetch);

/**
 * Transforms Operation for into HTTP results.
 * context can include the headers property, which will be passed to the fetch function
 */
export class BatchHttpLink extends ApolloLink {
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
      http: { includeExtensions, preserveHeaderCase },
      options: requestOptions.fetchOptions,
      credentials: requestOptions.credentials,
      headers: requestOptions.headers,
    };

    this.batchDebounce = batchDebounce;
    this.batchInterval = batchInterval || 10;
    this.batchMax = batchMax || 10;

    const batchHandler = (operations: Operation[]) => {
      const chosenURI = selectURI(operations[0], uri);

      const context = operations[0].getContext();

      const clientAwarenessHeaders: {
        "apollographql-client-name"?: string;
        "apollographql-client-version"?: string;
      } = {};
      if (context.clientAwareness) {
        const { name, version } = context.clientAwareness;
        if (name) {
          clientAwarenessHeaders["apollographql-client-name"] = name;
        }
        if (version) {
          clientAwarenessHeaders["apollographql-client-version"] = version;
        }
      }

      const contextConfig = {
        http: context.http,
        options: context.fetchOptions,
        credentials: context.credentials,
        headers: { ...clientAwarenessHeaders, ...context.headers },
      };

      const queries = operations.map(({ query }) => {
        if (hasDirectives(["client"], query)) {
          return removeClientSetsFromDocument(query);
        }

        return query;
      });

      // If we have a query that returned `null` after removing client-only
      // fields, it indicates a query that is using all client-only fields.
      if (queries.some((query) => !query)) {
        return fromError<FetchResult[]>(
          new Error(
            "BatchHttpLink: Trying to send a client-only query to the server. To send to the server, ensure a non-client field is added to the query or enable the `transformOptions.removeClientFields` option."
          )
        );
      }

      //uses fallback, link, and then context to build options
      const optsAndBody = operations.map((operation, index) => {
        const result = selectHttpOptionsAndBodyInternal(
          { ...operation, query: queries[index]! },
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
        return fromError<FetchResult[]>(
          new Error("apollo-link-batch-http does not support GET requests")
        );
      }

      try {
        (options as any).body = serializeFetchParameter(loadedBody, "Payload");
      } catch (parseError) {
        return fromError<FetchResult[]>(parseError);
      }

      let controller: AbortController | undefined;
      if (!options.signal && typeof AbortController !== "undefined") {
        controller = new AbortController();
        options.signal = controller.signal;
      }

      return new Observable<FetchResult[]>((observer) => {
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
            // if it is a network error, BUT there is graphql result info
            // fire the next observer before calling error
            // this gives apollo-client (and react-apollo) the `graphqlErrors` and `networkErrors`
            // to pass to UI
            // this should only happen if we *also* have data as part of the response key per
            // the spec
            if (err.result && err.result.errors && err.result.data) {
              // if we dont' call next, the UI can only show networkError because AC didn't
              // get andy graphqlErrors
              // this is graphql execution result info (i.e errors and possibly data)
              // this is because there is no formal spec how errors should translate to
              // http status codes. So an auth error (401) could have both data
              // from a public field, errors from a private field, and a status of 401
              // {
              //  user { // this will have errors
              //    firstName
              //  }
              //  products { // this is public so will have data
              //    cost
              //  }
              // }
              //
              // the result of above *could* look like this:
              // {
              //   data: { products: [{ cost: "$10" }] },
              //   errors: [{
              //      message: 'your session has timed out',
              //      path: []
              //   }]
              // }
              // status code of above would be a 401
              // in the UI you want to show data where you can, errors as data where you can
              // and use correct http status codes
              observer.next(err.result);
            }

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
