import type { RenderOptions } from "@testing-library/react";
import {
  createRenderStream,
  disableActEnvironment,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import { gql } from "graphql-tag";
import React, { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Observable } from "rxjs";

import type {
  DataState,
  ErrorLike,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";
import {
  ApolloClient,
  InMemoryCache,
  NetworkStatus,
  RefetchEventManager,
} from "@apollo/client";
import type { QueryRef } from "@apollo/client/react";
import { useLoadableQuery, useReadQuery } from "@apollo/client/react";
import { MockLink } from "@apollo/client/testing";
import { createClientWrapper } from "@apollo/client/testing/internal";
import { invariant } from "@apollo/client/utilities/invariant";

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
        delay: 20,
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

async function renderHook<
  TData,
  TVariables extends OperationVariables,
  TStates extends DataState<TData>["dataState"] = DataState<TData>["dataState"],
  Props = never,
>(
  renderHook: (
    props: Props extends never ? undefined : Props
  ) => useLoadableQuery.Result<TData, TVariables, TStates>,
  options: Pick<RenderOptions, "wrapper"> & { initialProps?: Props }
) {
  function UseReadQuery({
    queryRef,
  }: {
    queryRef: QueryRef<TData, TVariables, TStates>;
  }) {
    useTrackRenders({ name: "useReadQuery" });
    mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function SuspenseFallback() {
    useTrackRenders({ name: "SuspenseFallback" });

    return null;
  }

  function ErrorFallback() {
    useTrackRenders({ name: "ErrorBoundary" });

    return null;
  }

  function App({ props }: { props: Props | undefined }) {
    useTrackRenders({ name: "useLoadableQuery" });
    const [loadQuery, queryRef] = renderHook(props as any);

    mergeSnapshot({ loadQuery });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onError={(error) => replaceSnapshot({ error })}
        >
          {queryRef && <UseReadQuery queryRef={queryRef} />}
        </ErrorBoundary>
      </Suspense>
    );
  }

  const renderStream = createRenderStream<
    | {
        loadQuery: useLoadableQuery.LoadQueryFunction<TVariables>;
        result?: useReadQuery.Result<TData, TStates>;
      }
    | { error: ErrorLike }
  >({ initialSnapshot: { loadQuery: null as any } });

  const { mergeSnapshot, replaceSnapshot } = renderStream;

  const utils = await renderStream.render(
    <App props={options.initialProps} />,
    options
  );

  function rerender(props: Props) {
    return utils.rerender(<App props={props} />);
  }

  function getCurrentSnapshot() {
    const { snapshot } = renderStream.getCurrentRender();
    invariant(
      "loadQuery" in snapshot,
      "Expected rendered hook instead of error boundary"
    );

    return snapshot;
  }

  return { ...renderStream, getCurrentSnapshot, rerender };
}

test("refetches the loaded query when a source emits", async () => {
  const client = setupClient();

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderHook(
    () => useLoadableQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  getCurrentSnapshot().loadQuery();

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([
      "useLoadableQuery",
      "SuspenseFallback",
    ]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.refetchEventManager?.emit("test");

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 2 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(takeRender).not.toRerender();
});

test("does not refetch when refetchOn is false", async () => {
  const client = setupClient();

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderHook(
    () => useLoadableQuery(query, { refetchOn: false }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  getCurrentSnapshot().loadQuery();

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual([
      "useLoadableQuery",
      "SuspenseFallback",
    ]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.refetchEventManager?.emit("test");

  await expect(takeRender).not.toRerender();
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
  const { takeRender, getCurrentSnapshot } = await renderHook(
    () => useLoadableQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  getCurrentSnapshot().loadQuery();

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual([
      "useLoadableQuery",
      "SuspenseFallback",
    ]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();
    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.refetchEventManager?.emit("test");

  await expect(takeRender).not.toRerender();
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
  const { takeRender, getCurrentSnapshot } = await renderHook(
    () => useLoadableQuery(query, { refetchOn: true }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  getCurrentSnapshot().loadQuery();

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual([
      "useLoadableQuery",
      "SuspenseFallback",
    ]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();
    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.refetchEventManager?.emit("test");

  {
    const { snapshot, renderedComponents } = await takeRender();
    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 2 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(takeRender).not.toRerender();
});

test("refetchOn callback receives the event context and decides whether to refetch", async () => {
  const client = setupClient();
  const refetchOn = jest.fn(() => false);

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderHook(
    () => useLoadableQuery(query, { refetchOn }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  getCurrentSnapshot().loadQuery();

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual([
      "useLoadableQuery",
      "SuspenseFallback",
    ]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.refetchEventManager?.emit("test");

  expect(refetchOn).toHaveBeenCalledTimes(1);
  expect(refetchOn).toHaveBeenCalledWith({
    source: "test",
    payload: undefined,
  });

  await expect(takeRender).not.toRerender();
});

test("refetchOn: { eventName: false } opts out of specific events", async () => {
  const client = setupClient();

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderHook(
    () => useLoadableQuery(query, { refetchOn: { test: false } }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  getCurrentSnapshot().loadQuery();

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual([
      "useLoadableQuery",
      "SuspenseFallback",
    ]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.refetchEventManager?.emit("test");

  await expect(takeRender).not.toRerender();
});

test("uses the latest refetchOn value when re-rendered", async () => {
  const client = setupClient();

  using _disabledAct = disableActEnvironment();
  const renderStream = await renderHook(
    ({ refetchOn }) => useLoadableQuery(query, { refetchOn }),
    {
      wrapper: createClientWrapper(client),
      initialProps: { refetchOn: { test: false } },
    }
  );
  const { takeRender, getCurrentSnapshot, rerender } = renderStream;

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  getCurrentSnapshot().loadQuery();

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([
      "useLoadableQuery",
      "SuspenseFallback",
    ]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.refetchEventManager?.emit("test");
  await expect(takeRender).not.toRerender();

  await rerender({ refetchOn: { test: true } });
  await expect(renderStream).toRerenderWithSimilarSnapshot();

  client.refetchEventManager?.emit("test");

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 2 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(takeRender).not.toRerender();
});
