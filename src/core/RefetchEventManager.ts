import type { Subscription } from "rxjs";

import type { Observable, ObservableQuery } from "@apollo/client";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { invariant } from "@apollo/client/utilities/invariant";

import type { ApolloClient } from "./ApolloClient.js";
import type { RefetchEvents, RefetchOn } from "./types.js";

export declare namespace RefetchEventManager {
  export interface Options {
    /**
     * A mapping of event names to source functions. The source function is
     * called by the refetch event manager to begin listening for events that
     * trigger automatic refetches. Set to `true` if the event is only
     * triggered by calling `emit` and has no automatic detection logic.
     */
    sources?: {
      [Key in keyof RefetchEvents]?:
        | true
        | RefetchEventManager.EventSource<RefetchEvents[Key]>;
    };

    /**
     * A mapping of event names to handler functions that run
     * `client.refetchQueries`. Provide a handler for an event to customize
     * which queries are refetched when an event is triggered.
     */
    handlers?: {
      [Key in keyof RefetchEvents]?: RefetchEventManager.EventHandler<Key>;
    };
  }

  export type EventSource<T> = () => Observable<T>;
  export type EventHandler<
    TSource extends keyof RefetchEvents = keyof RefetchEvents,
  > = (
    context: RefetchEventManager.RefetchHandlerContext<TSource>
  ) => ApolloClient.RefetchQueriesResult<any> | void;

  export type RefetchHandlerContext<
    TSource extends keyof RefetchEvents = keyof RefetchEvents,
  > =
    TSource extends keyof RefetchEvents ?
      {
        /**
         * The `ApolloClient` instance connected to the refetch event manager.
         */
        client: ApolloClient;

        /**
         * Helper function that evaluates the `refetchOn` option.
         */
        matchesRefetchOn: (observableQuery: ObservableQuery<any>) => boolean;

        /**
         * The source name that triggered the refetch.
         */
        source: TSource;

        /**
         * Any data emitted by the source along with the event
         */
        payload: RefetchEvents[TSource];
      }
    : never;
}

const defaultHandler: RefetchEventManager.EventHandler<keyof RefetchEvents> = ({
  client,
  matchesRefetchOn,
}) => {
  return client.refetchQueries({
    include: "active",
    onQueryUpdated: matchesRefetchOn,
  });
};

export class RefetchEventManager {
  private sources: Partial<
    Record<keyof RefetchEvents, true | RefetchEventManager.EventSource<any>>
  >;
  private handlers: Partial<
    Record<keyof RefetchEvents, RefetchEventManager.EventHandler<any>>
  >;

  private subscriptions: Map<keyof RefetchEvents, Subscription> = new Map();

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
        this.setEventSource(event as keyof RefetchEvents, source);
      }
    });
  }

  /**
   * Disconnects the client from this refetch event manager and calls the cleanup
   * function for each event source.
   */
  disconnect(client?: ApolloClient) {
    if (client && this.client !== client) {
      return;
    }

    this.client = undefined;
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions.clear();
  }

  /**
   * Replaces the source for an event. If a source was previously configured
   * for the event, its cleanup function is called before the new source is
   * registered.
   */
  setEventSource<TSource extends keyof RefetchEvents>(
    name: TSource,
    source: RefetchEventManager.EventSource<RefetchEvents[TSource]>
  ) {
    this.subscriptions.get(name)?.unsubscribe();
    this.subscriptions.delete(name);
    this.sources[name] = source;

    if (this.client) {
      const observable = source();

      this.subscriptions.set(
        name,
        observable.subscribe((value) => this.emit(name as any, value))
      );
    }
  }

  /**
   * Removes the configured source for an event and runs its cleanup function.
   */
  removeEventSource(event: keyof RefetchEvents) {
    this.subscriptions.get(event)?.unsubscribe();
    this.subscriptions.delete(event);
    delete this.sources[event];
  }

  /**
   * Replaces the handler for an event.
   */
  setEventHandler<TSource extends keyof RefetchEvents>(
    source: TSource,
    handler: RefetchEventManager.EventHandler<TSource>
  ) {
    this.handlers[source] = handler;
  }

  /**
   * Manually triggers a refetch for the provided event.
   *
   * @remarks
   * This method warns and does not refetch if the refetch event manager is not
   * connected to a client or a source is not configured for the event.
   */
  emit<TSource extends keyof RefetchEvents>(
    source: TSource,
    ...args: RefetchEvents[TSource] extends void | never ? []
    : undefined extends RefetchEvents[TSource] ?
      [payload?: RefetchEvents[TSource]]
    : [payload: RefetchEvents[TSource]]
  ) {
    const [payload] = args;

    if (!this.client) {
      if (__DEV__) {
        invariant.warn(
          "Received '%s' event but an `ApolloClient` instance is not connected to the `RefetchEventManager`. No queries will refetch. Pass the manager to the `refetchEventManager` option on the `ApolloClient` constructor.",
          source
        );
      }

      return;
    }

    if (!(source in this.sources)) {
      if (__DEV__) {
        invariant.warn(
          "Received '%s' event but no source is configured for it on the `RefetchEventManager`. No queries will refetch. Add the event to the `sources` option or call `setEventSource`.",
          source
        );
      }

      return;
    }

    const handler: RefetchEventManager.EventHandler<any> =
      this.handlers[source] ?? defaultHandler;

    function matchesRefetchOn(oq: ObservableQuery<any>) {
      const ctx: RefetchOn.Context<any> = { source, payload };
      const refetchOn = oq.options.refetchOn;

      if (typeof refetchOn === "boolean") {
        return refetchOn;
      }

      if (typeof refetchOn === "function") {
        return refetchOn(ctx);
      }

      if (typeof refetchOn?.[source] === "function") {
        return refetchOn[source](ctx as any);
      }

      return refetchOn?.[source] !== false;
    }

    handler({ client: this.client, source, payload, matchesRefetchOn });
  }
}
