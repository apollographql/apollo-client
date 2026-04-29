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
import { useBackgroundQuery, useReadQuery } from "@apollo/client/react";
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

async function renderSuspenseHook<
  TData,
  TVariables extends OperationVariables,
  TQueryRef extends QueryRef<any, any, any>,
  TStates extends DataState<TData>["dataState"] = TQueryRef extends (
    QueryRef<any, any, infer States>
  ) ?
    States
  : never,
  Props = never,
>(
  renderHook: (
    props: Props extends never ? undefined : Props
  ) => [TQueryRef, useBackgroundQuery.Result<TData, TVariables>],
  options: Pick<RenderOptions, "wrapper"> & { initialProps?: Props }
) {
  function UseReadQuery({ queryRef }: { queryRef: QueryRef }) {
    useTrackRenders({ name: "useReadQuery" });
    renderStream.replaceSnapshot(useReadQuery(queryRef) as any);

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
    useTrackRenders({ name: "useBackgroundQuery" });
    const [queryRef] = renderHook(props as any);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onError={(error) => renderStream.replaceSnapshot({ error })}
        >
          <UseReadQuery queryRef={queryRef} />
        </ErrorBoundary>
      </Suspense>
    );
  }

  const renderStream = createRenderStream<
    useReadQuery.Result<TData, TStates> | { error: ErrorLike }
  >();

  const utils = await renderStream.render(
    <App props={options.initialProps} />,
    options
  );

  function rerender(props: Props) {
    return utils.rerender(<App props={props} />);
  }

  return { ...renderStream, rerender };
}

test("refetches the query when a source emits", async () => {
  const client = setupClient();

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useBackgroundQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual([
      "useBackgroundQuery",
      "SuspenseFallback",
    ]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.refetchEventManager?.emit("test");

  {
    const { snapshot, renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
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
  const { takeRender } = await renderSuspenseHook(
    () => useBackgroundQuery(query, { refetchOn: false }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual([
      "useBackgroundQuery",
      "SuspenseFallback",
    ]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
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
  const { takeRender } = await renderSuspenseHook(
    () => useBackgroundQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual([
      "useBackgroundQuery",
      "SuspenseFallback",
    ]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
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
  const { takeRender } = await renderSuspenseHook(
    () => useBackgroundQuery(query, { refetchOn: true }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual([
      "useBackgroundQuery",
      "SuspenseFallback",
    ]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.refetchEventManager?.emit("test");

  {
    const { snapshot, renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: { count: 2 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(takeRender).not.toRerender();
});

test("refetchOn callback decides whether to refetch based on its return value", async () => {
  const client = setupClient();
  const refetchOn = jest.fn(() => false);

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useBackgroundQuery(query, { refetchOn }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual([
      "useBackgroundQuery",
      "SuspenseFallback",
    ]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.refetchEventManager?.emit("test");

  expect(refetchOn).toHaveBeenCalledTimes(1);
  expect(refetchOn).toHaveBeenLastCalledWith({
    source: "test",
    payload: undefined,
  });

  await expect(takeRender).not.toRerender();

  refetchOn.mockReturnValue(true);
  client.refetchEventManager?.emit("test");

  expect(refetchOn).toHaveBeenCalledTimes(2);

  {
    const { snapshot, renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: { count: 2 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(takeRender).not.toRerender();
});

test("refetchOn: { eventName: false } opts out of specific events", async () => {
  const client = setupClient();

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useBackgroundQuery(query, { refetchOn: { test: false } }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual([
      "useBackgroundQuery",
      "SuspenseFallback",
    ]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
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
  const renderStream = await renderSuspenseHook(
    ({ refetchOn }) => useBackgroundQuery(query, { refetchOn }),
    {
      wrapper: createClientWrapper(client),
      initialProps: { refetchOn: { test: false } },
    }
  );

  const { takeRender, rerender } = renderStream;

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([
      "useBackgroundQuery",
      "SuspenseFallback",
    ]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
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

  await expect(renderStream).toRerenderWithSimilarSnapshot({
    expected: (previous) => ({
      ...previous,
      data: { count: 2 },
    }),
  });

  await expect(takeRender).not.toRerender();
});
