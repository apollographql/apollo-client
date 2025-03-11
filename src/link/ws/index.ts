import type { Observable } from "rxjs";
import type { ClientOptions } from "subscriptions-transport-ws";
import { SubscriptionClient } from "subscriptions-transport-ws";

import type { FetchResult, Operation } from "@apollo/client/link/core";
import { ApolloLink } from "@apollo/client/link/core";

export namespace WebSocketLink {
  /**
   * Configuration to use when constructing the subscription client (subscriptions-transport-ws).
   */
  export interface Configuration {
    /**
     * The endpoint to connect to.
     */
    uri: string;

    /**
     * Options to pass when constructing the subscription client.
     */
    options?: ClientOptions;

    /**
     * A custom WebSocket implementation to use.
     */
    webSocketImpl?: any;
  }
}

// For backwards compatibility.
export import WebSocketParams = WebSocketLink.Configuration;

export class WebSocketLink extends ApolloLink {
  private subscriptionClient: SubscriptionClient;

  constructor(
    paramsOrClient: WebSocketLink.Configuration | SubscriptionClient
  ) {
    super();

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

  public request(operation: Operation): Observable<FetchResult> | null {
    return this.subscriptionClient.request(
      operation
    ) as Observable<FetchResult>;
  }
}
