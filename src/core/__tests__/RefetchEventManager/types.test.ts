import { expectTypeOf } from "expect-type";

import type { Observable } from "@apollo/client";
import {
  ApolloClient,
  ApolloLink,
  gql,
  InMemoryCache,
  RefetchEventManager,
} from "@apollo/client";

declare module "@apollo/client" {
  interface RefetchEvents {
    test: void;
  }
}

declare const bool: boolean;
declare const eventSource: () => Observable<Event>;
declare const voidSource: () => Observable<void>;

describe.skip("type tests", () => {
  test("narrows context provided to handler per-source", () => {
    new RefetchEventManager({
      handlers: {
        windowFocus: ({ source, payload }) => {
          expectTypeOf(source).toEqualTypeOf<"windowFocus">();
          expectTypeOf(payload).toEqualTypeOf<Event>();
        },
        online: ({ source, payload }) => {
          expectTypeOf(source).toEqualTypeOf<"online">();
          expectTypeOf(payload).toEqualTypeOf<Event>();
        },
        test: ({ source, payload }) => {
          expectTypeOf(source).toEqualTypeOf<"test">();
          expectTypeOf(payload).toEqualTypeOf<void>();
        },

        // @ts-expect-error foo does not exist in RefetchEvents
        foo: () => {},
      },
    });
  });

  test("requires correct observable payload per-source", () => {
    new RefetchEventManager({
      sources: {
        windowFocus: eventSource,
        online: eventSource,
        test: voidSource,

        // @ts-expect-error foo does not exist in RefetchEvents
        foo: eventSource,
      },
    });

    new RefetchEventManager({
      sources: {
        // @ts-expect-error wrong observable payload type
        windowFocus: voidSource,
        // @ts-expect-error wrong observable payload type
        online: voidSource,
        // @ts-expect-error wrong observable payload type
        test: eventSource,
      },
    });
  });

  test("requires correct observable payload for setEventSource", () => {
    const refetchEventManager = new RefetchEventManager();

    refetchEventManager.setEventSource("windowFocus", eventSource);
    // @ts-expect-error wrong observable payload type
    refetchEventManager.setEventSource("windowFocus", voidSource);

    refetchEventManager.setEventSource("online", eventSource);
    // @ts-expect-error wrong observable payload type
    refetchEventManager.setEventSource("online", voidSource);

    refetchEventManager.setEventSource("test", voidSource);
    // @ts-expect-error wrong observable payload type
    refetchEventManager.setEventSource("test", eventSource);

    // @ts-expect-error foo not in RefetchEvents
    refetchEventManager.setEventSource("foo", eventSource);
    // @ts-expect-error foo not in RefetchEvents
    refetchEventManager.setEventSource("foo", voidSource);
  });

  test("enforces correct payload for emit", () => {
    const refetchEventManager = new RefetchEventManager();

    refetchEventManager.emit("windowFocus", new Event("visibilitychange"));

    // @ts-expect-error expected 2 arguments, but got 1
    refetchEventManager.emit("windowFocus");
    // @ts-expect-error wrong payload type
    refetchEventManager.emit("windowFocus", true);
    // @ts-expect-error wrong payload type
    refetchEventManager.emit("windowFocus", undefined);
    // @ts-expect-error wrong payload type
    refetchEventManager.emit("windowFocus", null);

    refetchEventManager.emit("online", new Event("online"));

    // @ts-expect-error expected 2 arguments, but got 1
    refetchEventManager.emit("online");
    // @ts-expect-error wrong payload type
    refetchEventManager.emit("online", true);
    // @ts-expect-error wrong payload type
    refetchEventManager.emit("online", undefined);
    // @ts-expect-error wrong payload type
    refetchEventManager.emit("online", null);

    refetchEventManager.emit("test");
    // @ts-expect-error expected 1 argument, but got 2
    refetchEventManager.emit("test", new Event("test"));

    // @ts-expect-error foo not in RefetchEvents
    refetchEventManager("foo");
    // @ts-expect-error foo not in RefetchEvents
    refetchEventManager("foo", new Event("test"));
  });

  test("provides context as union to refetchOn", () => {
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      refetchEventManager: new RefetchEventManager(),
    });

    client.watchQuery({
      query: gql``,
      refetchOn: (ctx) => {
        expectTypeOf(ctx).toEqualTypeOf<
          | { source: "windowFocus"; payload: Event }
          | { source: "online"; payload: Event }
          | { source: "test"; payload: void }
        >();

        return bool;
      },
    });
  });

  test("narrows context for per-source refetchOn", () => {
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      refetchEventManager: new RefetchEventManager(),
    });

    client.watchQuery({
      query: gql``,
      refetchOn: {
        windowFocus: (ctx) => {
          expectTypeOf(ctx).toEqualTypeOf<{
            source: "windowFocus";
            payload: Event;
          }>();

          return bool;
        },
        online: (ctx) => {
          expectTypeOf(ctx).toEqualTypeOf<{
            source: "online";
            payload: Event;
          }>();

          return bool;
        },
        test: (ctx) => {
          expectTypeOf(ctx).toEqualTypeOf<{ source: "test"; payload: void }>();

          return bool;
        },

        // @ts-expect-error foo not in RefetchEvents
        foo: () => bool,
      },
    });
  });
});
