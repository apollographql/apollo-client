import type { ASTNode, print } from "graphql";
import { Observable } from "rxjs";

import { ApolloLink } from "@apollo/client/link";
import { filterOperationVariables } from "@apollo/client/link/utils";
import {
  isMutationOperation,
  isSubscriptionOperation,
} from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { compact } from "@apollo/client/utilities/internal";
import { maybe } from "@apollo/client/utilities/internal/globals";

import { checkFetcher } from "./checkFetcher.js";
import {
  parseAndCheckHttpResponse,
  readMultipartBody,
} from "./parseAndCheckHttpResponse.js";
import { rewriteURIForGET } from "./rewriteURIForGET.js";
import {
  defaultPrinter,
  fallbackHttpConfig,
  selectHttpOptionsAndBodyInternal,
} from "./selectHttpOptionsAndBody.js";
import { selectURI } from "./selectURI.js";

const backupFetch = maybe(() => fetch);
function noop() {}

export declare namespace BaseHttpLink {
  /**
   * Options passed to `BaseHttpLink` through [request context](https://apollographql.com/docs/react/api/link/introduction#managing-context). Previous
   * non-terminating links in the link chain also can set these values to
   * customize the behavior of `BaseHttpLink` for each operation.
   *
   * > [!NOTE]
   * > Some of these values can also be provided to the `HttpLink` constructor.
   * > If a value is provided to both, the value in `context` takes precedence.
   */
  interface ContextOptions {
    /** {@inheritDoc @apollo/client/link/http!BaseHttpLink.Shared.Options#uri:member} */
    uri?: string | BaseHttpLink.UriFunction;

    /** {@inheritDoc @apollo/client/link/http!BaseHttpLink.Shared.Options#headers:member} */
    headers?: Record<string, string>;

    /** {@inheritDoc @apollo/client/link/http!BaseHttpLink.Shared.Options#credentials:member} */
    credentials?: RequestCredentials;

    /** {@inheritDoc @apollo/client/link/http!BaseHttpLink.Shared.Options#fetchOptions:member} */
    fetchOptions?: RequestInit;

    /**
     * An object that configures advanced functionality, such as support for
     * persisted queries.
     */
    http?: BaseHttpLink.HttpOptions;
  }

  /**
   * Options passed to `BaseHttpLink` through the `http` property of a request
   * context.
   */
  export interface HttpOptions {
    /** {@inheritDoc @apollo/client/link/http!BaseHttpLink.Shared.Options#includeExtensions:member} */
    includeExtensions?: boolean;

    /**
     * If `false`, the GraphQL query string is not included in the request. Set
     * this option if you're sending a request that uses a [persisted query](https://www.apollographql.com/docs/react/api/link/persisted-queries/).
     *
     * @defaultValue `true`
     */
    includeQuery?: boolean;

    /** {@inheritDoc @apollo/client/link/http!BaseHttpLink.Shared.Options#preserveHeaderCase:member} */
    preserveHeaderCase?: boolean;

    /**
     * A list of additional `accept` headers to include in the request,
     * as defined in https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.2
     *
     * @example
     *
     * ```json
     * ["application/custom+json;q=1.0"]
     * ```
     */
    accept?: string[];
  }

  export namespace Shared {
    /** These options are shared between `BaseHttpLink` and `BaseBatchHttpLink` */
    export interface Options {
      /**
       * The URL of the GraphQL endpoint to send requests to. Can also be a
       * function that accepts an `ApolloLink.Operation` object and returns the
       * string URL to use for that operation.
       *
       * @defaultValue "/graphql"
       */
      uri?: string | BaseHttpLink.UriFunction;

      /**
       * If `true`, includes the `extensions` field in operations sent to your
       * GraphQL endpoint.
       *
       * @defaultValue true
       */
      includeExtensions?: boolean;

      /**
       * A function to use instead of calling the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) directly
       * when sending HTTP requests to your GraphQL endpoint. The function must
       * conform to the signature of `fetch`.
       *
       * By default, the Fetch API is used unless it isn't available in your
       * runtime environment.
       *
       * See [Customizing `fetch`](https://apollographql.com/docs/react/api/link/introduction#customizing-fetch).
       */
      fetch?: typeof fetch;

      /**
       * An object representing headers to include in every HTTP request.
       *
       * @example
       *
       * ```json
       * {
       *   "Authorization": "Bearer 1234"
       * }
       * ```
       */
      headers?: Record<string, string>;

      /**
       * If `true`, header names won't be automatically normalized to lowercase.
       * This allows for non-http-spec-compliant servers that might expect
       * capitalized header names.
       *
       * @defaultValue false
       */
      preserveHeaderCase?: boolean;

      /**
       * The credentials policy to use for each `fetch` call.
       */
      credentials?: RequestCredentials;

      /**
       * Any overrides of the fetch options argument to pass to the fetch call.
       *
       * An object containing options to use for each call to `fetch`. If a
       * particular option is not included in this object, the default value of
       * that option is used.
       *
       * > [!NOTE]
       * > If you set `fetchOptions.method` to `GET`, `HttpLink` follows [standard
       * > GraphQL HTTP GET encoding](http://graphql.org/learn/serving-over-http/#get-request).
       *
       * See [available options](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters)
       */
      fetchOptions?: RequestInit;

      /**
       * If `true`, unused variables from the operation will not be stripped from
       * the request and will instead be sent to the GraphQL endpoint.
       *
       * @remarks
       * Unused variables are likely to trigger server-side validation errors,
       * per https://spec.graphql.org/draft/#sec-All-Variables-Used.
       * `includeUnusedVariables` can be useful if your server deviates
       * from the GraphQL specification by not strictly enforcing that rule.
       *
       * @defaultValue false
       */
      includeUnusedVariables?: boolean;
      /**
       * A function to use when transforming a GraphQL document into a string. It
       * accepts an `ASTNode` (typically a `DocumentNode`) and the original `print`
       * function as arguments, and is expected to return a string. This option
       * enables you to, for example, use `stripIgnoredCharacters` to remove
       * whitespace from queries.
       *
       * By default the [GraphQL `print` function](https://graphql.org/graphql-js/language/#print) is used.
       *
       * @example
       *
       * ```ts
       * import { stripIgnoredCharacters } from "graphql";
       *
       * const httpLink = new HttpLink({
       *   uri: "/graphql",
       *   print: (ast, originalPrint) => stripIgnoredCharacters(originalPrint(ast)),
       * });
       * ```
       */
      print?: BaseHttpLink.Printer;
    }
  }

  /**
   * Options provided to the `BaseHttpLink` constructor.
   *
   * > [!NOTE]
   * > Some of these options are also available to override in [request context](https://apollographql.com/docs/react/api/link/introduction#managing-context).
   * > Context options override the options passed to the constructor. Treat
   * > these options as default values that are used when the request context
   * > does not override the value.
   */
  interface Options extends Shared.Options {
    /**
     * If `true`, the link uses an HTTP `GET` request when sending query
     * operations to your GraphQL endpoint. Mutation operations continue to use
     * `POST` requests. If you want all operations to use `GET` requests,
     * set `fetchOptions.method` instead.
     *
     * @defaultValue false
     */
    useGETForQueries?: boolean;
  }

  interface Body {
    query?: string;
    operationName?: string;
    variables?: Record<string, any>;
    extensions?: Record<string, any>;
  }

  type Printer = (node: ASTNode, originalPrint: typeof print) => string;
  type UriFunction = (operation: ApolloLink.Operation) => string;
}

/**
 * `BaseHttpLink` is a terminating link that sends a GraphQL operation to a
 * remote endpoint over HTTP. It serves as a base link to `HttpLink`.
 *
 * @remarks
 *
 * `BaseHttpLink` supports both POST and GET requests, and you can configure
 * HTTP options on a per-operation basis. You can use these options for
 * authentication, persisted queries, dynamic URIs, and other granular updates.
 *
 * > [!NOTE]
 * > Prefer using `HttpLink` over `BaseHttpLink`. Use `BaseHttpLink` when you
 * > need to disable client awareness features and would like to tree-shake
 * > the implementation of `ClientAwarenessLink` out of your app bundle.
 *
 * @example
 *
 * ```ts
 * import { BaseHttpLink } from "@apollo/client/link/http";
 *
 * const link = new BaseHttpLink({
 *   uri: "http://localhost:4000/graphql",
 *   headers: {
 *     authorization: `Bearer ${token}`,
 *   },
 * });
 * ```
 */
export class BaseHttpLink extends ApolloLink {
  constructor(options: BaseHttpLink.Options = {}) {
    let {
      uri = "/graphql",
      // use default global fetch if nothing passed in
      fetch: preferredFetch,
      print = defaultPrinter,
      includeExtensions,
      preserveHeaderCase,
      useGETForQueries,
      includeUnusedVariables = false,
      ...requestOptions
    } = options;

    if (__DEV__) {
      // Make sure at least one of preferredFetch, window.fetch, or backupFetch is
      // defined, so requests won't fail at runtime.
      checkFetcher(preferredFetch || backupFetch);
    }

    const linkConfig = {
      http: compact({ includeExtensions, preserveHeaderCase }),
      options: requestOptions.fetchOptions,
      credentials: requestOptions.credentials,
      headers: requestOptions.headers,
    };

    super((operation) => {
      let chosenURI = selectURI(operation, uri);

      const context = operation.getContext();

      const http = { ...context.http };
      if (isSubscriptionOperation(operation.query)) {
        http.accept = [
          "multipart/mixed;boundary=graphql;subscriptionSpec=1.0",
          ...(http.accept || []),
        ];
      }

      const contextConfig = {
        http,
        options: context.fetchOptions,
        credentials: context.credentials,
        headers: context.headers,
      };

      //uses fallback, link, and then context to build options
      const { options, body } = selectHttpOptionsAndBodyInternal(
        operation,
        print,
        fallbackHttpConfig,
        linkConfig,
        contextConfig
      );

      if (body.variables && !includeUnusedVariables) {
        body.variables = filterOperationVariables(
          body.variables,
          operation.query
        );
      }

      let controller: AbortController | undefined = new AbortController();
      let cleanupController = () => {
        controller = undefined;
      };
      if (options.signal) {
        const externalSignal: AbortSignal = options.signal;
        // in an ideal world we could use `AbortSignal.any` here, but
        // React Native uses https://github.com/mysticatea/abort-controller as
        // a polyfill for `AbortController`, and it does not support `AbortSignal.any`.

        const listener = () => {
          controller?.abort(externalSignal.reason);
        };
        externalSignal.addEventListener("abort", listener, { once: true });
        cleanupController = () => {
          controller?.signal.removeEventListener("abort", cleanupController);
          controller = undefined;
          // on cleanup, we need to stop listening to `options.signal` to avoid memory leaks
          externalSignal.removeEventListener("abort", listener);
          cleanupController = noop;
        };
        // react native also does not support the addEventListener `signal` option
        // so we have to simulate that ourself
        controller.signal.addEventListener("abort", cleanupController, {
          once: true,
        });
      }
      options.signal = controller.signal;

      if (useGETForQueries && !isMutationOperation(operation.query)) {
        options.method = "GET";
      }

      return new Observable((observer) => {
        if (options.method === "GET") {
          const { newURI, parseError } = rewriteURIForGET(chosenURI, body);
          if (parseError) {
            throw parseError;
          }
          chosenURI = newURI;
        } else {
          options.body = JSON.stringify(body);
        }
        // Prefer linkOptions.fetch (preferredFetch) if provided, and otherwise
        // fall back to the *current* global window.fetch function (see issue
        // #7832), or (if all else fails) the backupFetch function we saved when
        // this module was first evaluated. This last option protects against the
        // removal of window.fetch, which is unlikely but not impossible.
        const currentFetch =
          preferredFetch || maybe(() => fetch) || backupFetch;

        const observerNext = observer.next.bind(observer);
        currentFetch!(chosenURI, options)
          .then((response) => {
            operation.setContext({ response });
            const ctype = response.headers?.get("content-type");

            if (ctype !== null && /^multipart\/mixed/i.test(ctype)) {
              return readMultipartBody(response, observerNext);
            } else {
              return parseAndCheckHttpResponse(operation)(response).then(
                observerNext
              );
            }
          })
          .then(() => {
            cleanupController();
            observer.complete();
          })
          .catch((err) => {
            cleanupController();
            observer.error(err);
          });

        return () => {
          // XXX support canceling this request
          // https://developers.google.com/web/updates/2017/09/abortable-fetch
          if (controller) controller.abort();
        };
      });
    });
  }
}
