import { ApolloLink } from "@apollo/client/link";
import { ClientAwarenessLink } from "@apollo/client/link/client-awareness";

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
  interface ContextOptions
    extends BaseHttpLink.ContextOptions,
      ClientAwarenessLink.ContextOptions {}

  /**
   * Options provided to the `HttpLink` constructor.
   *
   * > [!NOTE]
   * > Some of these options are also available to override in [request context](https://apollographql.com/docs/react/api/link/introduction#managing-context).
   * > Context options override the options passed to the constructor. Treat
   * > these options as default values that are used when the request context
   * > does not override the value.
   */
  interface Options extends BaseHttpLink.Options, ClientAwarenessLink.Options {}
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
  constructor(options: HttpLink.Options = {}) {
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
export const createHttpLink = (options: HttpLink.Options = {}) =>
  new HttpLink(options);
