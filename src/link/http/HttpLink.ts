import { ApolloLink } from "@apollo/client/link/core";

import { createHttpLink } from "./createHttpLink.js";
import type { HttpOptions, UriFunction } from "./selectHttpOptionsAndBody.js";

export declare namespace HttpLink {
  export interface ContextOptions {
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

  export interface HttpOptions {
    /**
     * If `true`, includes the `extensions` field in operations sent to your
     * GraphQL endpoint.
     *
     * @defaultValue false
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
  }
}

export class HttpLink extends ApolloLink {
  constructor(public options: HttpOptions = {}) {
    super(createHttpLink(options).request);
  }
}
