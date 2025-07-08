import type { ASTNode } from "graphql";

import type { Operation } from "@apollo/client/link";
import { ApolloLink } from "@apollo/client/link";
import { ClientAwarenessLink } from "@apollo/client/link/client-awareness";
import type { print } from "@apollo/client/utilities";

import { BaseHttpLink } from "./BaseHttpLink.js";

export declare namespace HttpLink {
  /**
   * Options passed to `HttpLink` through request context.
   */
  interface ContextOptions {
    /**
     * The URL of the GraphQL endpoint to send requests to. Can also be a
     * function that accepts an `Operation` object and returns the string URL to
     * use for that operation.
     */
    uri?: string | UriFunction;

    /**
     * An object representing headers to include in the HTTP request, such as
     * `{Authorization: 'Bearer abc123'}`.
     */
    headers?: Record<string, string>;

    /**
     * The credentials policy to use for this fetch call. Can be `omit`, `include`,
     * or `same-origin`.
     */
    credentials?: RequestCredentials;

    /**
     * An object containing options to use for this call to `fetch`. If a
     * particular option is not included in this object, the default value of
     * that option is used.
     *
     * Note that if you set `fetchOptions.method` to `GET`, `HttpLink` follows
     * [standard GraphQL HTTP GET encoding](http://graphql.org/learn/serving-over-http/#get-request).
     */
    fetchOptions?: RequestInit;

    /**
     * An object that configures advanced `HttpLink` functionality, such as
     * support for persisted queries.
     */
    http?: HttpOptions;
  }

  /**
   * Options passed to `HttpLink` through the `http` constructor option
   * or the `http` property of a request context.
   */
  export interface HttpOptions {
    /**
     * If `true`, includes the `extensions` field in operations sent to your
     * GraphQL endpoint.
     *
     * @defaultValue true
     */
    includeExtensions?: boolean;

    /**
     * If `false`, the GraphQL query string is not included in the request. Set
     * this option if you're sending a request that uses a [persisted query](https://www.apollographql.com/docs/react/api/link/persisted-queries/).
     *
     * @defaultValue true
     */
    includeQuery?: boolean;

    /**
     * If set to true, header names won't be automatically normalized to
     * lowercase. This allows for non-http-spec-compliant servers that might
     * expect capitalized header names.
     *
     * @defaultValue false
     */
    preserveHeaderCase?: boolean;

    /**
     * A list of additional `accept` headers to include in the request,
     * as defined in
     * https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.2
     *
     * @example
     * ```javascript
     * ["application/custom+json;q=1.0"]
     * ```
     */
    accept?: string[];
  }

  /**
   * Options for the `HttpLink` constructor.
   */
  export interface Options {
    /**
     * The URI to use when fetching operations.
     *
     * Defaults to '/graphql'.
     */
    uri?: string | UriFunction;

    /**
     * Passes the extensions field to your graphql server.
     *
     * Defaults to true.
     */
    includeExtensions?: boolean;

    /**
     * A `fetch`-compatible API to use when making requests.
     */
    fetch?: typeof fetch;

    /**
     * An object representing values to be sent as headers on the request.
     */
    headers?: Record<string, string>;

    /**
     * If set to true, header names won't be automatically normalized to
     * lowercase. This allows for non-http-spec-compliant servers that might
     * expect capitalized header names.
     */
    preserveHeaderCase?: boolean;

    /**
     * The credentials policy you want to use for the fetch call.
     */
    credentials?: string;

    /**
     * Any overrides of the fetch options argument to pass to the fetch call.
     */
    fetchOptions?: any;

    /**
     * If set to true, use the HTTP GET method for query operations. Mutations
     * will still use the method specified in fetchOptions.method (which defaults
     * to POST).
     */
    useGETForQueries?: boolean;

    /**
     * If set to true, the default behavior of stripping unused variables
     * from the request will be disabled.
     *
     * Unused variables are likely to trigger server-side validation errors,
     * per https://spec.graphql.org/draft/#sec-All-Variables-Used, but this
     * includeUnusedVariables option can be useful if your server deviates
     * from the GraphQL specification by not strictly enforcing that rule.
     */
    includeUnusedVariables?: boolean;
    /**
     * A function to substitute for the default query print function. Can be
     * used to apply changes to the results of the print function.
     */
    print?: Printer;
  }

  interface Body {
    query?: string;
    operationName?: string;
    variables?: Record<string, any>;
    extensions?: Record<string, any>;
  }

  type Printer = (node: ASTNode, originalPrint: typeof print) => string;
  type UriFunction = (operation: Operation) => string;
}

export class HttpLink extends ApolloLink {
  constructor(options: HttpLink.Options & ClientAwarenessLink.Options = {}) {
    const { left, right, request } = ApolloLink.concat(
      new ClientAwarenessLink(options),
      new BaseHttpLink(options)
    );
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
