import { __DEV__ } from "@apollo/client/utilities/environment";
import { invariant } from "@apollo/client/utilities/invariant";

import type { ApolloClient } from "./ApolloClient.js";
import type { RefetchEvent } from "./types.js";

export declare namespace RefetchEventManager {
  export interface Options {
    /**
     * A mapping of event names to source functions. The source function is
     * called by the refetch event manager to begin listening for events that
     * trigger automatic refetches. Set to `true` if the event is only
     * triggered by calling `emit` and has no automatic detection logic.
     */
    sources?: Partial<
      Record<RefetchEvent, true | RefetchEventManager.EventSource>
    >;

    /**
     * A mapping of event names to handler functions that run
     * `client.refetchQueries`. Provide a handler for an event to customize
     * which queries are refetched when an event is triggered.
     */
    handlers?: Partial<Record<RefetchEvent, RefetchEventManager.EventHandler>>;
  }

  export type EventSource = (emit: () => void) => (() => void) | void;
  export type EventHandler = (
    context: RefetchEventManager.RefetchHandlerContext
  ) => ApolloClient.RefetchQueriesResult<any> | void;

  export interface RefetchHandlerContext {
    /**
     * The `ApolloClient` instance connected to the refetch event manager.
     */
    client: ApolloClient;

    /**
     * The event that triggered the refetch.
     */
    event: RefetchEvent;
  }

  export interface RefetchOnContext {
    /**
     * The event that triggered the refetch.
     */
    event: RefetchEvent;
  }

  export type RefetchOnCallback = (
    context: RefetchEventManager.RefetchOnContext
  ) => boolean;

  export type RefetchOnOption =
    | boolean
    | RefetchEventManager.RefetchOnCallback
    | Partial<
        Record<RefetchEvent, boolean | RefetchEventManager.RefetchOnCallback>
      >;
}

function defaultHandler({
  client,
  event,
}: RefetchEventManager.RefetchHandlerContext) {
  return client.refetchQueries({
    include: "active",
    onQueryUpdated: (oq) => {
      const refetchOn = oq.options.refetchOn;

      if (typeof refetchOn === "boolean") {
        return refetchOn;
      }

      if (typeof refetchOn === "function") {
        return refetchOn({ event });
      }

      if (typeof refetchOn?.[event] === "function") {
        return refetchOn[event]({ event });
      }

      return refetchOn?.[event] !== false;
    },
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

  constructor(options: RefetchEventManager.Options = {}) {
    this.sources = options.sources ?? {};
    this.handlers = options.handlers ?? {};
  }

  /**
   * Connects the client to this refetch event manager. Connecting a client
   * calls each configured source function so they can begin listening for events.
   */
  connect(client: ApolloClient) {
    if (this.client === client) {
      return;
    }

    if (this.client) {
      if (__DEV__) {
        invariant.warn(
          "Connected an `ApolloClient` instance to a `RefetchEventManager` that was already connected to a different `ApolloClient`. The previous client has been disconnected and will no longer receive refetch events from this manager."
        );
      }
      this.disconnect();
    }

    this.client = client;

    Object.entries(this.sources).forEach(([event, source]) => {
      if (typeof source === "function") {
        this.setEventSource(event as RefetchEvent, source);
      }
    });
  }

  /**
   * Disconnects the client from this refetch event manager and calls the cleanup
   * function for each event source.
   */
  disconnect() {
    this.client = undefined;
    this.cleanupFns.forEach((cleanup) => cleanup());
    this.cleanupFns.clear();
  }

  /**
   * Replaces the source for an event. If a source was previously configured
   * for the event, its cleanup function is called before the new source is
   * registered.
   */
  setEventSource(event: RefetchEvent, source: RefetchEventManager.EventSource) {
    this.cleanupFns.get(event)?.();
    this.cleanupFns.delete(event);
    this.sources[event] = source;

    if (this.client) {
      const cleanup = source(() => {
        this.emit(event);
      });

      if (cleanup) {
        this.cleanupFns.set(event, cleanup);
      }
    }
  }

  /**
   * Removes the configured source for an event and runs its cleanup function.
   */
  removeEventSource(event: RefetchEvent) {
    this.cleanupFns.get(event)?.();
    this.cleanupFns.delete(event);
    delete this.sources[event];
  }

  /**
   * Replaces the handler for an event.
   */
  setEventHandler(
    event: RefetchEvent,
    handler: RefetchEventManager.EventHandler
  ) {
    this.handlers[event] = handler;
  }

  /**
   * Manually triggers a refetch for the provided event.
   *
   * @remarks
   * This method warns and does not refetch if the refetch event manager is not
   * connected to a client or a source is not configured for the event.
   */
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
