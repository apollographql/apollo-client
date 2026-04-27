import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { gql } from "graphql-tag";

import {
  ApolloClient,
  NetworkStatus,
  RefetchEventManager,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { MockLink } from "@apollo/client/testing";
import {
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";

declare module "@apollo/client" {
  interface RefetchEvents {
    test: true;
  }
}

const query: TypedDocumentNode<{ count: number }, { id: string }> = gql`
  query CountQuery($id: ID!) {
    count(id: $id)
  }
`;

test("ApolloClient automatically connects and calls source functions when provided to the constructor", async () => {
  const source: RefetchEventManager.EventSource = jest.fn(() => () => {});

  const refetchEventManager = new RefetchEventManager({
    sources: {
      test: source,
    },
  });

  expect(source).not.toHaveBeenCalled();

  new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
    refetchEventManager,
  });

  expect(source).toHaveBeenCalledTimes(1);
});

test("can manually connect RefetchEventManager to ApolloClient", async () => {
  const source: RefetchEventManager.EventSource = jest.fn(() => () => {});

  const refetchEventManager = new RefetchEventManager({
    sources: {
      test: source,
    },
  });

  expect(source).not.toHaveBeenCalled();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
  });

  expect(source).not.toHaveBeenCalled();

  refetchEventManager.connect(client);

  expect(source).toHaveBeenCalledTimes(1);
});

test("calls cleanup function when changing source functions", async () => {
  const cleanup = jest.fn();

  const source: RefetchEventManager.EventSource = () => cleanup;

  const refetchEventManager = new RefetchEventManager({
    sources: {
      test: source,
    },
  });

  new ApolloClient({
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        refetchOn: false,
      },
    },
    link: new MockLink([]),
    refetchEventManager,
  });

  refetchEventManager.setEventSource("test", source);

  expect(cleanup).toHaveBeenCalledTimes(1);
});

test("does not call cleanup when refetchEventManager hasn't been connected to the client", async () => {
  const cleanup = jest.fn();

  const source: RefetchEventManager.EventSource = () => cleanup;

  const refetchEventManager = new RefetchEventManager({
    sources: {
      test: source,
    },
  });

  refetchEventManager.setEventSource("test", source);

  expect(cleanup).not.toHaveBeenCalled();
});

test("refetches active queries when a source emits", async () => {
  const counts: Record<string, number> = {};
  let emitTestEvent!: () => void;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
      },
    }),
  });

  const streamA = new ObservableStream(
    client.watchQuery({ query, variables: { id: "a" } })
  );
  const streamB = new ObservableStream(
    client.watchQuery({ query, variables: { id: "b" } })
  );

  await expect(streamA).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });
  await expect(streamB).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(streamA).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(streamB).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitTestEvent();

  await expect(streamA).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });
  await expect(streamB).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(streamA).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
  await expect(streamB).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(streamA).not.toEmitAnything();
  await expect(streamB).not.toEmitAnything();
});

test("does not refetch standby queries by default", async () => {
  const counts: Record<string, number> = {};
  let emitTestEvent!: () => void;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
      },
    }),
  });

  const streamA = new ObservableStream(
    client.watchQuery({ query, variables: { id: "a" }, fetchPolicy: "standby" })
  );
  const streamB = new ObservableStream(
    client.watchQuery({ query, variables: { id: "b" }, fetchPolicy: "standby" })
  );

  await expect(streamA).not.toEmitAnything();
  await expect(streamB).not.toEmitAnything();

  emitTestEvent();

  await expect(streamA).not.toEmitAnything();
  await expect(streamB).not.toEmitAnything();
});

test("skips refetches on queries that opt out with refetchOn: false", async () => {
  const counts: Record<string, number> = {};
  let emitTestEvent!: () => void;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
      },
    }),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, variables: { id: "a" }, refetchOn: false })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitTestEvent();

  await expect(stream).not.toEmitAnything();
});

test("skips refetches on queries that opt out with refetchOn: { eventName: false }", async () => {
  const counts: Record<string, number> = {};
  let emitTestEvent!: () => void;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
      },
    }),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      variables: { id: "a" },
      refetchOn: { test: false },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitTestEvent();

  await expect(stream).not.toEmitAnything();
});

test("skips refetches only on events where refetchOn is disabled", async () => {
  const counts: Record<string, number> = {};
  let emitTestEvent!: () => void;
  let emitWindowFocus!: () => void;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
        windowFocus: (emit) => {
          emitWindowFocus = emit;

          return () => {};
        },
      },
    }),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      variables: { id: "a" },
      refetchOn: { test: false },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitTestEvent();

  await expect(stream).not.toEmitAnything();

  emitWindowFocus();

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("honors defaultOptions with refetchOn: false", async () => {
  const counts: Record<string, number> = {};
  let emitTestEvent!: () => void;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        refetchOn: false,
      },
    },
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
      },
    }),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, variables: { id: "a" } })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitTestEvent();

  await expect(stream).not.toEmitAnything();
});

test("honors defaultOptions with refetchOn: { eventName: false }", async () => {
  const counts: Record<string, number> = {};
  let emitTestEvent!: () => void;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        refetchOn: { test: false },
      },
    },
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
      },
    }),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, variables: { id: "a" } })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitTestEvent();

  await expect(stream).not.toEmitAnything();
});

test("can enable automatic refetches with refetchOn: { eventName: true } when defaultOptions disables refetches", async () => {
  const counts: Record<string, number> = {};
  let emitTestEvent!: () => void;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        refetchOn: false,
      },
    },
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
      },
    }),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      variables: { id: "a" },
      refetchOn: { test: true },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitTestEvent();

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("can set a custom handler with own refetchQueries logic", async () => {
  const counts: Record<string, number> = {};
  const handler = jest.fn((({ client }) => {
    return client.refetchQueries({
      include: "active",
      onQueryUpdated: (oq) => oq.variables.id === "a",
    });
  }) satisfies RefetchEventManager.EventHandler);
  let emitTestEvent!: () => void;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
      },
      handlers: {
        test: handler,
      },
    }),
  });

  const streamA = new ObservableStream(
    client.watchQuery({ query, variables: { id: "a" } })
  );
  const streamB = new ObservableStream(
    client.watchQuery({ query, variables: { id: "b" } })
  );

  await expect(streamA).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });
  await expect(streamB).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(streamA).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
  await expect(streamB).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  expect(handler).not.toHaveBeenCalled();

  emitTestEvent();

  expect(handler).toHaveBeenCalledTimes(1);
  expect(handler).toHaveBeenCalledWith({ client, event: "test" });

  await expect(streamA).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });
  await expect(streamA).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(streamA).not.toEmitAnything();
  await expect(streamB).not.toEmitAnything();
});

test("custom handler can conditionally skip refetch", async () => {
  const counts: Record<string, number> = {};
  const handler = jest.fn((({ client, event }) => {
    if (event !== "test") {
      return client.refetchQueries({
        include: "active",
        onQueryUpdated: (oq) => oq.variables.id === "a",
      });
    }
  }) satisfies RefetchEventManager.EventHandler);
  let emitTestEvent!: () => void;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
      },
      handlers: {
        test: handler,
      },
    }),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, variables: { id: "a" } })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitTestEvent();

  expect(handler).toHaveBeenCalledTimes(1);
  expect(handler).toHaveBeenCalledWith({ client, event: "test" });

  await expect(stream).not.toEmitAnything();
});

test("setEventHandler replaces the handler after construction", async () => {
  let emitTestEvent!: () => void;

  const refetchEventManager = new RefetchEventManager({
    sources: {
      test: (emit) => {
        emitTestEvent = emit;

        return () => {};
      },
    },
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { id: "a" } },
        result: { data: { count: 1 } },
      },
    ]),
    refetchEventManager,
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, variables: { id: "a" } })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  const handler = jest.fn();

  refetchEventManager.setEventHandler("test", handler);
  emitTestEvent();

  expect(handler).toHaveBeenCalledTimes(1);
  expect(handler).toHaveBeenCalledWith({ client, event: "test" });

  await expect(stream).not.toEmitAnything();
});

test("can manually trigger refetch with emit", async () => {
  const counts: Record<string, number> = {};

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: () => {
          return () => {};
        },
      },
    }),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, variables: { id: "a" } })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  client.refetchEventManager?.emit("test");

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
  await expect(stream).not.toEmitAnything();
});

test("can manually trigger refetch with emit when source is set to true", async () => {
  const counts: Record<string, number> = {};

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: true,
      },
    }),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, variables: { id: "a" } })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  client.refetchEventManager?.emit("test");

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
  await expect(stream).not.toEmitAnything();
});

test("warns and no-ops when emit is called before a client is connected", () => {
  using _ = spyOnConsole("warn");

  const refetchEventManager = new RefetchEventManager({
    sources: { test: true },
  });

  refetchEventManager.emit("test");

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "Received '%s' event but an `ApolloClient` instance is not connected to the `RefetchEventManager`. No queries will refetch. Pass the manager to the `refetchEventManager` option on the `ApolloClient` constructor.",
    "test"
  );
});

test("warns and no-ops when emit is called for an event that is not configured as a source", () => {
  using _ = spyOnConsole("warn");

  const refetchEventManager = new RefetchEventManager();

  new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
    refetchEventManager,
  });

  refetchEventManager.emit("test");

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "Received '%s' event but no source is configured for it on the `RefetchEventManager`. No queries will refetch. Add the event to the `sources` option or call `setEventSource`.",
    "test"
  );
});

test("warns and no-ops when emit is called for event that has handler but not a source", () => {
  using _ = spyOnConsole("warn");

  const handler = jest.fn();

  const refetchEventManager = new RefetchEventManager({
    sources: {},
    handlers: { test: handler },
  });

  new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
    refetchEventManager,
  });

  refetchEventManager.emit("test");

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "Received '%s' event but no source is configured for it on the `RefetchEventManager`. No queries will refetch. Add the event to the `sources` option or call `setEventSource`.",
    "test"
  );
  expect(handler).not.toHaveBeenCalled();
});

test("calls cleanup for every source on disconnect", () => {
  const cleanupTest = jest.fn();
  const cleanupWindowFocus = jest.fn();

  const refetchEventManager = new RefetchEventManager({
    sources: {
      test: () => cleanupTest,
      windowFocus: () => cleanupWindowFocus,
    },
  });

  new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
    refetchEventManager,
  });

  expect(cleanupTest).not.toHaveBeenCalled();
  expect(cleanupWindowFocus).not.toHaveBeenCalled();

  refetchEventManager.disconnect();

  expect(cleanupTest).toHaveBeenCalledTimes(1);
  expect(cleanupWindowFocus).toHaveBeenCalledTimes(1);
});

test("client.stop() disconnects the manager and calls source cleanup", () => {
  const cleanup = jest.fn();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: () => cleanup,
      },
    }),
  });

  expect(cleanup).not.toHaveBeenCalled();

  client.stop();

  expect(cleanup).toHaveBeenCalledTimes(1);
});

test("does not trigger refetches after disconnect", async () => {
  using _ = spyOnConsole("warn");

  let emitTestEvent!: () => void;

  const refetchEventManager = new RefetchEventManager({
    sources: {
      test: (emit) => {
        emitTestEvent = emit;

        return () => {};
      },
    },
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { id: "a" } },
        result: { data: { count: 1 } },
      },
    ]),
    refetchEventManager,
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, variables: { id: "a" } })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  refetchEventManager.disconnect();

  emitTestEvent();

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "Received '%s' event but an `ApolloClient` instance is not connected to the `RefetchEventManager`. No queries will refetch. Pass the manager to the `refetchEventManager` option on the `ApolloClient` constructor.",
    "test"
  );

  await expect(stream).not.toEmitAnything();
});

test("supports mixing `true` and function sources in one manager", async () => {
  const counts: Record<string, number> = {};
  let emitWindowFocus!: () => void;

  const refetchEventManager = new RefetchEventManager({
    sources: {
      test: true,
      windowFocus: (emit) => {
        emitWindowFocus = emit;

        return () => {};
      },
    },
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager,
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, variables: { id: "a" } })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  refetchEventManager.emit("test");

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitWindowFocus();

  await expect(stream).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 3 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("per-query refetchOn merges with defaultOptions.watchQuery.refetchOn", async () => {
  const counts: Record<string, number> = {};
  let emitTestEvent!: () => void;
  let emitWindowFocus!: () => void;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        refetchOn: { test: false, windowFocus: false },
      },
    },
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
        windowFocus: (emit) => {
          emitWindowFocus = emit;

          return () => {};
        },
      },
    }),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      variables: { id: "a" },
      refetchOn: { test: true },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitTestEvent();

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitWindowFocus();

  await expect(stream).not.toEmitAnything();
});

test("mutating client.defaultOptions.watchQuery.refetchOn does not affect existing queries", async () => {
  const counts: Record<string, number> = {};
  let emitTestEvent!: () => void;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        refetchOn: { test: true },
      },
    },
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
      },
    }),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, variables: { id: "a" } })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  client.defaultOptions.watchQuery!.refetchOn = { test: false };

  emitTestEvent();

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("per-query refetchOn: false replaces a partial defaultOptions refetchOn object", async () => {
  let emitTestEvent!: () => void;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        refetchOn: { test: true },
      },
    },
    link: new MockLink([
      {
        request: { query, variables: { id: "a" } },
        result: { data: { count: 1 } },
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
      },
    }),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      variables: { id: "a" },
      refetchOn: false,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitTestEvent();

  await expect(stream).not.toEmitAnything();
});

test("calls source functions when manager reconnects to a client after disconnect", async () => {
  const counts: Record<string, number> = {};
  let emitTestEvent: (() => void) | undefined;

  const refetchEventManager = new RefetchEventManager({
    sources: {
      test: (emit) => {
        emitTestEvent = emit;

        return () => {
          emitTestEvent = undefined;
        };
      },
    },
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager,
  });

  refetchEventManager.disconnect();
  expect(emitTestEvent).toBeUndefined();

  refetchEventManager.connect(client);
  expect(emitTestEvent).toBeDefined();

  const stream = new ObservableStream(
    client.watchQuery({ query, variables: { id: "a" } })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitTestEvent!();

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("warns and replaces the previously connected client when connect is called with a different client", () => {
  using _ = spyOnConsole("warn");

  const cleanup = jest.fn();
  const source: RefetchEventManager.EventSource = jest.fn(() => cleanup);

  const refetchEventManager = new RefetchEventManager({
    sources: { test: source },
  });

  new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
    refetchEventManager,
  });

  expect(source).toHaveBeenCalledTimes(1);
  expect(cleanup).not.toHaveBeenCalled();
  expect(console.warn).not.toHaveBeenCalled();

  new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
    refetchEventManager,
  });

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "Connected an `ApolloClient` instance to a `RefetchEventManager` that was already connected to a different `ApolloClient`. The previous client has been disconnected and will no longer receive refetch events from this manager."
  );

  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(source).toHaveBeenCalledTimes(2);
});

test("does not warn or rewire sources when connect is called with the same already-connected client", () => {
  using _ = spyOnConsole("warn");

  const cleanup = jest.fn();
  const source: RefetchEventManager.EventSource = jest.fn(() => cleanup);

  const refetchEventManager = new RefetchEventManager({
    sources: { test: source },
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
    refetchEventManager,
  });

  expect(source).toHaveBeenCalledTimes(1);

  refetchEventManager.connect(client);

  expect(console.warn).not.toHaveBeenCalled();
  expect(source).toHaveBeenCalledTimes(1);
  expect(cleanup).not.toHaveBeenCalled();
});

test("setEventSource adds an event that was not declared in the constructor", async () => {
  const counts: Record<string, number> = {};
  let emitWindowFocus!: () => void;

  const refetchEventManager = new RefetchEventManager();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager,
  });

  refetchEventManager.setEventSource("windowFocus", (emit) => {
    emitWindowFocus = emit;

    return () => {};
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, variables: { id: "a" } })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitWindowFocus();

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("setEventSource before connect does not invoke the source function until connect is called", () => {
  const source: RefetchEventManager.EventSource = jest.fn(() => () => {});

  const refetchEventManager = new RefetchEventManager();

  refetchEventManager.setEventSource("test", source);

  expect(source).not.toHaveBeenCalled();

  new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
    refetchEventManager,
  });

  expect(source).toHaveBeenCalledTimes(1);
});

test("disconnect cleans up sources added via setEventSource after construction", () => {
  const cleanup = jest.fn();

  const refetchEventManager = new RefetchEventManager();

  new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
    refetchEventManager,
  });

  refetchEventManager.setEventSource("test", () => cleanup);

  expect(cleanup).not.toHaveBeenCalled();

  refetchEventManager.disconnect();

  expect(cleanup).toHaveBeenCalledTimes(1);
});

test("removeSource calls cleanup and stops the event from triggering refetches", () => {
  using _ = spyOnConsole("warn");

  const cleanup = jest.fn();

  const refetchEventManager = new RefetchEventManager({
    sources: {
      test: () => cleanup,
    },
  });

  new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
    refetchEventManager,
  });

  expect(cleanup).not.toHaveBeenCalled();

  refetchEventManager.removeSource("test");

  expect(cleanup).toHaveBeenCalledTimes(1);

  refetchEventManager.emit("test");

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "Received '%s' event but no source is configured for it on the `RefetchEventManager`. No queries will refetch. Add the event to the `sources` option or call `setEventSource`.",
    "test"
  );
});

test("removeSource removes events declared with `true`", () => {
  using _ = spyOnConsole("warn");

  const refetchEventManager = new RefetchEventManager({
    sources: { test: true },
  });

  new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
    refetchEventManager,
  });

  refetchEventManager.removeSource("test");

  refetchEventManager.emit("test");

  expect(console.warn).toHaveBeenCalledTimes(1);
});

test("removeSource is a no-op when called for an event that was never declared", () => {
  const refetchEventManager = new RefetchEventManager();

  expect(() => refetchEventManager.removeSource("test")).not.toThrow();
});

test("removeSource works before the manager is connected", () => {
  const source: RefetchEventManager.EventSource = jest.fn(() => () => {});

  const refetchEventManager = new RefetchEventManager({
    sources: { test: source },
  });

  refetchEventManager.removeSource("test");

  new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
    refetchEventManager,
  });

  expect(source).not.toHaveBeenCalled();
});

test("source functions are not required to return a cleanup function", async () => {
  const counts: Record<string, number> = {};
  let emitTestEvent!: () => void;

  const refetchEventManager = new RefetchEventManager({
    sources: {
      test: (emit) => {
        emitTestEvent = emit;
      },
    },
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager,
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, variables: { id: "a" } })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitTestEvent();

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  expect(() => refetchEventManager.disconnect()).not.toThrow();
});

test("setEventSource calls the previous cleanup once when replacing with a source that returns no cleanup", () => {
  const previousCleanup = jest.fn();

  const refetchEventManager = new RefetchEventManager({
    sources: { test: () => previousCleanup },
  });

  new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
    refetchEventManager,
  });

  expect(previousCleanup).not.toHaveBeenCalled();

  refetchEventManager.setEventSource("test", () => {});

  expect(previousCleanup).toHaveBeenCalledTimes(1);

  refetchEventManager.disconnect();

  expect(previousCleanup).toHaveBeenCalledTimes(1);
});

test("per-query refetchOn: true enables every event regardless of defaultOptions", async () => {
  const counts: Record<string, number> = {};
  let emitTestEvent!: () => void;
  let emitWindowFocus!: () => void;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        refetchOn: false,
      },
    },
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
        windowFocus: (emit) => {
          emitWindowFocus = emit;

          return () => {};
        },
      },
    }),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      variables: { id: "a" },
      refetchOn: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitTestEvent();

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitWindowFocus();

  await expect(stream).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 3 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("defaultOptions refetchOn: true enables every event for all queries", async () => {
  const counts: Record<string, number> = {};
  let emitTestEvent!: () => void;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        refetchOn: true,
      },
    },
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
      },
    }),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, variables: { id: "a" } })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitTestEvent();

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("calls top-level refetchOn callback to determine if a query refetches per event", async () => {
  const counts: Record<string, number> = {};
  let emitTestEvent!: () => void;
  let emitWindowFocus!: () => void;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
        windowFocus: (emit) => {
          emitWindowFocus = emit;

          return () => {};
        },
      },
    }),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      variables: { id: "a" },
      refetchOn: ({ event }) => event === "test",
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitTestEvent();

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitWindowFocus();

  await expect(stream).not.toEmitAnything();
});

test("calls per-event refetchOn callback to determine if a query refetches", async () => {
  const counts: Record<string, number> = {};
  let emitTestEvent!: () => void;
  let allowed = false;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
      },
    }),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      variables: { id: "a" },
      refetchOn: { test: () => allowed },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitTestEvent();

  await expect(stream).not.toEmitAnything();

  allowed = true;

  emitTestEvent();

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("passes the event to the refetchOn callback context", async () => {
  let emitTestEvent!: () => void;
  let emitWindowFocus!: () => void;
  const callback = jest.fn(() => false);

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { id: "a" } },
        result: { data: { count: 1 } },
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
        windowFocus: (emit) => {
          emitWindowFocus = emit;

          return () => {};
        },
      },
    }),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      variables: { id: "a" },
      refetchOn: callback,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitTestEvent();
  emitWindowFocus();

  expect(callback).toHaveBeenNthCalledWith(1, { event: "test" });
  expect(callback).toHaveBeenNthCalledWith(2, { event: "windowFocus" });
});

test("supports mixing booleans and callbacks within the per-event refetchOn object", async () => {
  const counts: Record<string, number> = {};
  let emitTestEvent!: () => void;
  let emitWindowFocus!: () => void;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: () => true },
        result: ({ id }) => {
          counts[id] ??= 0;

          return { data: { count: ++counts[id] } };
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: (emit) => {
          emitTestEvent = emit;

          return () => {};
        },
        windowFocus: (emit) => {
          emitWindowFocus = emit;

          return () => {};
        },
      },
    }),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      variables: { id: "a" },
      refetchOn: {
        windowFocus: false,
        test: () => true,
      },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  emitWindowFocus();

  await expect(stream).not.toEmitAnything();

  emitTestEvent();

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("warns when refetchOn is provided but refetchEventManager is not configured", async () => {
  using _ = spyOnConsole("warn");

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
  });

  client.watchQuery({ query, variables: { id: "1" }, refetchOn: true });

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "`refetchOn` was set on query '%s' but no `RefetchEventManager` is configured on this `ApolloClient` instance. This option has no effect. Pass a `RefetchEventManager` instance to the `refetchEventManager` option on the `ApolloClient` constructor.",
    "CountQuery"
  );
});
