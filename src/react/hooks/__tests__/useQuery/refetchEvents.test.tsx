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
import { useQuery } from "@apollo/client/react";
import { MockLink } from "@apollo/client/testing";
import { createClientWrapper } from "@apollo/client/testing/internal";

declare module "@apollo/client" {
  interface RefetchEvents {
    test: void;
  }
}

interface CountData {
  count: number;
}

const query: TypedDocumentNode<CountData> = gql`
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

test("refetches the query when a source emits", async () => {
  const client = setupClient();

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });

  client.refetchEventManager?.emit("test");

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: { count: 1 },
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});

test("does not refetch when refetchOn is false", async () => {
  const client = setupClient();

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { refetchOn: false }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });

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
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });

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
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { refetchOn: true }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });

  client.refetchEventManager?.emit("test");

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { count: 1 },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: { count: 1 },
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});

test("refetchOn callback receives the event context and decides whether to refetch", async () => {
  const client = setupClient();
  const refetchOn = jest.fn(() => false);

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { refetchOn }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });

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
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { refetchOn: { test: false } }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });

  client.refetchEventManager?.emit("test");

  await expect(takeSnapshot).not.toRerender();
});
