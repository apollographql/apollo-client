import { __DEV__ } from "@apollo/client/utilities/environment";
import { invariant } from "@apollo/client/utilities/invariant";

import type { ApolloClient } from "./ApolloClient.js";
import type { RefetchEvent } from "./types.js";

export declare namespace RefetchEventManager {
  export interface Options {
    sources?: Partial<
      Record<RefetchEvent, true | RefetchEventManager.EventSource>
    >;
    handlers?: Partial<Record<RefetchEvent, RefetchEventManager.EventHandler>>;
  }

  export type EventSource = (emit: () => void) => () => void;
  export type EventHandler = (
    context: RefetchEventManager.RefetchHandlerContext
  ) => ApolloClient.RefetchQueriesResult<any> | void;

  export interface RefetchHandlerContext {
    client: ApolloClient;
    event: RefetchEvent;
  }
}

function defaultHandler({
  client,
  event,
}: RefetchEventManager.RefetchHandlerContext) {
  return client.refetchQueries({
    include: "active",
    onQueryUpdated: (oq) =>
      oq.options.refetchOn !== false && oq.options.refetchOn?.[event] !== false,
  });
}

export class RefetchEventManager {
  private sources: Partial<
    Record<RefetchEvent, true | RefetchEventManager.EventSource>
  >;
  private handlers: Partial<
    Record<RefetchEvent, RefetchEventManager.EventHandler>
  >;

  private cleanupFns: Map<RefetchEvent, () => void> = new Map();

  private client: ApolloClient | undefined;

  constructor(options: RefetchEventManager.Options) {
    this.sources = options.sources ?? {};
    this.handlers = options.handlers ?? {};
  }

  connect(client: ApolloClient) {
    this.client = client;

    Object.entries(this.sources).forEach(([event, source]) => {
      if (typeof source === "function") {
        this.setEventSource(event as RefetchEvent, source);
      }
    });
  }

  disconnect() {
    this.client = undefined;

    Object.keys(this.sources).forEach((key) => {
      const event = key as RefetchEvent;

      if (this.cleanupFns.has(event)) {
        this.cleanupFns.get(event)!();
      }
    });
  }

  setEventSource(event: RefetchEvent, source: RefetchEventManager.EventSource) {
    this.cleanupFns.get(event)?.();

    this.cleanupFns.set(
      event,
      source(() => {
        this.emit(event);
      })
    );
  }

  setEventHandler(
    event: RefetchEvent,
    handler: RefetchEventManager.EventHandler
  ) {
    this.handlers[event] = handler;
  }

  emit(event: RefetchEvent) {
    if (!this.client) {
      if (__DEV__) {
        invariant.warn(
          "Received '%s' event but an `ApolloClient` instance is not connected to the `RefetchEventManager`. No queries will refetch. Pass the manager to the `refetchEventManager` option on the `ApolloClient` constructor.",
          event
        );
      }

      return;
    }

    if (!(event in this.sources)) {
      if (__DEV__) {
        invariant.warn(
          "Received '%s' event but no source is configured for it on the `RefetchEventManager`. No queries will refetch. Add the event to the `sources` option or call `setEventSource`.",
          event
        );
      }

      return;
    }

    const handler = this.handlers[event] ?? defaultHandler;

    handler({ client: this.client, event });
  }
}
