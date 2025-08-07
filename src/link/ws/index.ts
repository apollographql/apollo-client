import type { Observable } from "rxjs";
import type { ClientOptions } from "subscriptions-transport-ws";
import { SubscriptionClient } from "subscriptions-transport-ws";

import { ApolloLink } from "@apollo/client/link";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { invariant } from "@apollo/client/utilities/invariant";

export declare namespace WebSocketLink {
  /**
   * Configuration options for creating a `WebSocketLink` instance.
   *
   * @remarks
   *
   * These configuration options are used when creating a `WebSocketLink` without
   * providing an existing `SubscriptionClient` instance. The options are passed
   * directly to the `SubscriptionClient` constructor from the `subscriptions-transport-ws`
   * library.
   */
  export interface Configuration {
    /**
     * The WebSocket endpoint URI to connect to.
     *
     * This should be a valid WebSocket URI (starting with `ws://` or `wss://`)
     * that points to your GraphQL subscription endpoint.
     *
     * @example "ws://localhost:4000/subscriptions"
     * @example "wss://api.example.com/graphql"
     */
    uri: string;

    /**
     * Configuration options passed to the underlying `SubscriptionClient`.
     *
     * These options configure the WebSocket connection behavior, including
     * reconnection settings, connection parameters, and event handlers.
     *
     * For a complete list of available options, see the
     * [supported `subscriptions-transport-ws` options](https://github.com/apollographql/subscriptions-transport-ws/blob/master/src/client.ts#L61-L71).
     */
    options?: ClientOptions;

    /**
     * A custom WebSocket implementation to use for the connection.
     *
     * This is useful in environments that don't have native WebSocket support.
     * You can provide a WebSocket polyfill or implementation that conforms to
     * the W3C WebSocket API.
     *
     * @example
     *
     * ```ts
     * import WebSocket from "ws";
     *
     * const wsLink = new WebSocketLink({
     *   uri: "ws://localhost:4000/subscriptions",
     *   webSocketImpl: WebSocket,
     * });
     * ```
     */
    webSocketImpl?: any;
  }
}

/**
 * `WebSocketLink` is a terminating link that executes GraphQL operations over
 * WebSocket connections using the `subscriptions-transport-ws` library. It's
 * primarily used for GraphQL subscriptions but can also handle queries and
 * mutations.
 *
 * @example
 *
 * ```ts
 * import { WebSocketLink } from "@apollo/client/link/ws";
 * import { SubscriptionClient } from "subscriptions-transport-ws";
 *
 * const wsLink = new WebSocketLink(
 *   new SubscriptionClient("ws://localhost:4000/subscriptions", {
 *     reconnect: true,
 *   })
 * );
 * ```
 *
 * @deprecated `WebSocketLink` uses the deprecated and unmaintained
 * `subscriptions-transport-ws` library. This link is no longer maintained and
 * will be removed in a future major version of Apollo Client. We recommend
 * switching to `GraphQLWsLink`, which uses the [`graphql-ws` library](https://the-guild.dev/graphql/ws) to
 * send GraphQL operations through WebSocket connections.
 */
export class WebSocketLink extends ApolloLink {
  private subscriptionClient: SubscriptionClient;

  constructor(
    paramsOrClient: WebSocketLink.Configuration | SubscriptionClient
  ) {
    super();

    if (__DEV__) {
      invariant.warn(
        "`WebSocketLink` uses the deprecated and unmaintained `subscriptions-transport-ws` library. This link is no longer maintained and will be removed in a future major version of Apollo Client. We recommend switching to `GraphQLWsLink` which uses the `graphql-ws` library to send GraphQL operations through WebSocket connections (https://the-guild.dev/graphql/ws)."
      );
    }

    if (paramsOrClient instanceof SubscriptionClient) {
      this.subscriptionClient = paramsOrClient;
    } else {
      this.subscriptionClient = new SubscriptionClient(
        paramsOrClient.uri,
        paramsOrClient.options,
        paramsOrClient.webSocketImpl
      );
    }
  }

  public request(
    operation: ApolloLink.Operation
  ): Observable<ApolloLink.Result> {
    return this.subscriptionClient.request(
      operation
    ) as Observable<ApolloLink.Result>;
  }
}
