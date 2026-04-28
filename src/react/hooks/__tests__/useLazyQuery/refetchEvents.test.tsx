import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { gql } from "graphql-tag";
import { Observable } from "rxjs";

import type { TypedDocumentNode } from "@apollo/client";
import {
  ApolloClient,
  InMemoryCache,
  NetworkStatus,
  RefetchEventManager,
} from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";
import { MockLink } from "@apollo/client/testing";
import { createClientWrapper } from "@apollo/client/testing/internal";

declare module "@apollo/client" {
  interface RefetchEvents {
    test: void;
  }
}

const query: TypedDocumentNode<{ count: number }> = gql`
  query Count {
    count
  }
`;

function setupClient(options?: Partial<ApolloClient.Options>) {
  let count = 0;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: () => ({ data: { count: ++count } }),
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: () => new Observable(),
      },
    }),
    ...options,
  });

  return client;
}

test("refetches the executed query when a source emits", async () => {
  const client = setupClient();

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  {
    const [, result] = await takeSnapshot();
    expect(result).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();
  await execute();

  {
    const [, result] = await takeSnapshot();
    expect(result).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      called: true,
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: {},
    });
  }

  {
    const [, result] = await takeSnapshot();
    expect(result).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  client.refetchEventManager?.emit("test");

  {
    const [, result] = await takeSnapshot();
    expect(result).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      called: true,
      loading: true,
      networkStatus: NetworkStatus.refetch,
      previousData: undefined,
      variables: {},
    });
  }

  {
    const [, result] = await takeSnapshot();
    expect(result).toStrictEqualTyped({
      data: { count: 2 },
      dataState: "complete",
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: { count: 1 },
      variables: {},
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("does not refetch when refetchOn is false", async () => {
  const client = setupClient();

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query, { refetchOn: false }),
    { wrapper: createClientWrapper(client) }
  );

  // initial
  await takeSnapshot();

  const [execute] = getCurrentSnapshot();
  await execute();

  // loading
  await takeSnapshot();
  // ready
  await takeSnapshot();

  client.refetchEventManager?.emit("test");

  await expect(takeSnapshot).not.toRerender();
});

test("does not refetch when defaultOptions.watchQuery.refetchOn is false", async () => {
  const client = setupClient({
    defaultOptions: {
      watchQuery: {
        refetchOn: false,
      },
    },
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query),
    {
      wrapper: createClientWrapper(client),
    }
  );

  // initial
  await takeSnapshot();

  const [execute] = getCurrentSnapshot();
  await execute();

  // loading
  await takeSnapshot();
  // ready
  await takeSnapshot();

  client.refetchEventManager?.emit("test");

  await expect(takeSnapshot).not.toRerender();
});

test("per-query refetchOn: true overrides defaultOptions disabling refetches", async () => {
  const client = setupClient({
    defaultOptions: {
      watchQuery: {
        refetchOn: false,
      },
    },
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query, { refetchOn: true }),
    { wrapper: createClientWrapper(client) }
  );

  // initial
  await takeSnapshot();

  const [execute] = getCurrentSnapshot();
  await execute();

  // loading
  await takeSnapshot();

  {
    const [, result] = await takeSnapshot();
    expect(result).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  client.refetchEventManager?.emit("test");

  {
    const [, result] = await takeSnapshot();
    expect(result).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      called: true,
      loading: true,
      networkStatus: NetworkStatus.refetch,
      previousData: undefined,
      variables: {},
    });
  }

  {
    const [, result] = await takeSnapshot();
    expect(result).toStrictEqualTyped({
      data: { count: 2 },
      dataState: "complete",
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: { count: 1 },
      variables: {},
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("refetchOn callback receives the event context and decides whether to refetch", async () => {
  const client = setupClient();
  const refetchOn = jest.fn(() => false);

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query, { refetchOn }),
    { wrapper: createClientWrapper(client) }
  );

  // initial
  await takeSnapshot();

  const [execute] = getCurrentSnapshot();
  await execute();

  // loading
  await takeSnapshot();
  // ready
  await takeSnapshot();

  client.refetchEventManager?.emit("test");

  expect(refetchOn).toHaveBeenCalledTimes(1);
  expect(refetchOn).toHaveBeenCalledWith({
    source: "test",
    payload: undefined,
  });

  await expect(takeSnapshot).not.toRerender();
});

test("refetchOn: { eventName: false } opts out of specific events", async () => {
  const client = setupClient();

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query, { refetchOn: { test: false } }),
    { wrapper: createClientWrapper(client) }
  );

  // initial
  await takeSnapshot();

  const [execute] = getCurrentSnapshot();
  await execute();

  // loading
  await takeSnapshot();
  // ready
  await takeSnapshot();

  client.refetchEventManager?.emit("test");

  await expect(takeSnapshot).not.toRerender();
});
