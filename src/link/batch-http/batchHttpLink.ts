import { ApolloLink } from "@apollo/client/link";
import { ClientAwarenessLink } from "@apollo/client/link/client-awareness";
import { __DEV__ } from "@apollo/client/utilities/environment";

import { BaseBatchHttpLink } from "./BaseBatchHttpLink.js";

export declare namespace BatchHttpLink {
  /**
   * Options provided to the `BatchHttpLink` constructor.
   */
  export interface Options
    extends BaseBatchHttpLink.Options,
      ClientAwarenessLink.Options {}

  /**
   * Options passed to `BatchHttpLink` through [request context](https://apollographql.com/docs/react/api/link/introduction#managing-context). Previous
   * non-terminating links in the link chain also can set these values to
   * customize the behavior of `BatchHttpLink` for each operation.
   *
   * > [!NOTE]
   * > Some of these values can also be provided to the `BatchHttpLink` constructor.
   * > If a value is provided to both, the value in `context` takes precedence.
   */
  export interface ContextOptions
    extends BaseBatchHttpLink.ContextOptions,
      ClientAwarenessLink.ContextOptions {}
}

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
  constructor(options: BatchHttpLink.Options = {}) {
    const { left, right, request } = ApolloLink.from([
      new ClientAwarenessLink(options),
      new BaseBatchHttpLink(options),
    ]);
    super(request);
    Object.assign(this, { left, right });
  }
}
