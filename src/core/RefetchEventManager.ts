import type { ApolloClient } from "./ApolloClient.js";
import type { RefetchEvent } from "./types.js";

export declare namespace RefetchEventManager {
  export interface Options {
    sources?: Partial<Record<RefetchEvent, RefetchEventManager.EventSource>>;
    handlers?: Partial<Record<RefetchEvent, RefetchEventManager.EventHandler>>;
  }

  export type EventSource = (emit: () => void) => () => void;
  export type EventHandler = (
    context: RefetchEventManager.RefetchHandlerContext
  ) =>
    | ApolloClient.RefetchQueriesResult<Promise<ApolloClient.QueryResult<any>>>
    | undefined;

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
    Record<RefetchEvent, RefetchEventManager.EventSource>
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
      this.addListener(event as RefetchEvent, source);
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
    if (this.cleanupFns.has(event)) {
      this.cleanupFns.get(event)!();
    }

    this.addListener(event, source);
  }

  setEventHandler(
    event: RefetchEvent,
    handler: RefetchEventManager.EventHandler
  ) {
    this.handlers[event] = handler;
  }

  emit(event: RefetchEvent) {
    const handler = this.handlers[event] ?? defaultHandler;

    if (this.client) {
      handler({ client: this.client, event });
    }
  }

  private addListener(
    event: RefetchEvent,
    source: RefetchEventManager.EventSource
  ) {
    const emit = () => {
      this.emit(event);
    };

    const cleanup = source(emit);

    this.cleanupFns.set(event, cleanup);
  }
}
