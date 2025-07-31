import type { ASTNode } from "graphql";

import { ApolloLink } from "@apollo/client/link";
import { ClientAwarenessLink } from "@apollo/client/link/client-awareness";
import type { print } from "@apollo/client/utilities";

import { BaseHttpLink } from "./BaseHttpLink.js";

export declare namespace HttpLink {
  /**
   * Options passed to `HttpLink` through [request context](https://apollographql.com/docs/react/api/link/introduction#managing-context). Previous
   * non-terminating links in the link chain also can set these values to
   * customize the behavior of `HttpLink` for each operation.
   *
   * > [!NOTE]
   * > Some of these values can also be provided to the `HttpLink` constructor.
   * > If a value is provided to both, the value in `context` takes precedence.
   */
  interface ContextOptions {
    /** {@inheritDoc @apollo/client/link/http!HttpLink.Options#uri:member} */
    uri?: string | HttpLink.UriFunction;

    /** {@inheritDoc @apollo/client/link/http!HttpLink.Options#headers:member} */
    headers?: Record<string, string>;

    /** {@inheritDoc @apollo/client/link/http!HttpLink.Options#credentials:member} */
    credentials?: RequestCredentials;

    /** {@inheritDoc @apollo/client/link/http!HttpLink.Options#fetchOptions:member} */
    fetchOptions?: RequestInit;

    /**
     * An object that configures advanced `HttpLink` functionality, such as
     * support for persisted queries.
     */
    http?: HttpLink.HttpOptions;
  }

  /**
   * Options passed to `HttpLink` through the `http` property of a request
   * context.
   */
  export interface HttpOptions {
    /** {@inheritDoc @apollo/client/link/http!HttpLink.Options#includeExtensions:member} */
    includeExtensions?: boolean;

    /**
     * If `false`, the GraphQL query string is not included in the request. Set
     * this option if you're sending a request that uses a [persisted query](https://www.apollographql.com/docs/react/api/link/persisted-queries/).
     *
     * @defaultValue true
     */
    includeQuery?: boolean;

    /** {@inheritDoc @apollo/client/link/http!HttpLink.Options#preserveHeaderCase:member} */
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

  /**
   * Options provided to the `HttpLink` constructor.
   *
   * > [!NOTE]
   * > Some of these options are also available to override in [request context](https://apollographql.com/docs/react/api/link/introduction#managing-context).
   * > Context options override the options passed to the constructor. Treat
   * > these options as default values that are used when the request context
   * > does not override the value.
   */
  export interface Options {
    /**
     * The URL of the GraphQL endpoint to send requests to. Can also be a
     * function that accepts an `ApolloLink.Operation` object and returns the
     * string URL to use for that operation.
     *
     * @defaultValue "/graphql"
     */
    uri?: string | HttpLink.UriFunction;

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
     * If `true`, the link uses an HTTP `GET` request when sending query
     * operations to your GraphQL endpoint. Mutation operations continue to use
     * `POST` requests. If you want all operations to use `GET` requests,
     * set `fetchOptions.method` instead.
     *
     * @defaultValue false
     */
    useGETForQueries?: boolean;

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
    print?: HttpLink.Printer;
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
 * `HttpLink` is a terminating link that sends a GraphQL operation to a remote
 * endpoint over HTTP. It combines the functionality of `BaseHttpLink` and
 * `ClientAwarenessLink` into a single link.
 *
 * @remarks
 *
 * `HttpLink` supports both POST and GET requests, and you can configure HTTP
 * options on a per-operation basis. You can use these options for
 * authentication, persisted queries, dynamic URIs, and other granular updates.
 *
 * @example
 *
 * ```ts
 * import { HttpLink } from "@apollo/client";
 *
 * const link = new HttpLink({
 *   uri: "http://localhost:4000/graphql",
 *   // Additional options
 * });
 * ```
 */
export class HttpLink extends ApolloLink {
  constructor(options: HttpLink.Options & ClientAwarenessLink.Options = {}) {
    const { left, right, request } = ApolloLink.from([
      new ClientAwarenessLink(options),
      new BaseHttpLink(options),
    ]);
    super(request);
    Object.assign(this, { left, right });
  }
}

/**
 * @deprecated
 * Use `HttpLink` from `@apollo/client/link/http` instead.
 */
export const createHttpLink = (
  linkOptions: HttpLink.Options & ClientAwarenessLink.Options = {}
) => new HttpLink(linkOptions);
