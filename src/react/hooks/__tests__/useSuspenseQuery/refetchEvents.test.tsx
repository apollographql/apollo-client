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
import { useSuspenseQuery } from "@apollo/client/react";
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
  Props = never,
>(
  renderHook: (
    props: Props extends never ? undefined : Props
  ) => useSuspenseQuery.Result<TData, TVariables>,
  options: Pick<RenderOptions, "wrapper"> & { initialProps?: Props }
) {
  function UseSuspenseQuery({ props }: { props: Props | undefined }) {
    useTrackRenders({ name: "useSuspenseQuery" });
    replaceSnapshot(renderHook(props as any));

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
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onError={(error) => replaceSnapshot({ error })}
        >
          <UseSuspenseQuery props={props} />
        </ErrorBoundary>
      </Suspense>
    );
  }

  const { render, takeRender, replaceSnapshot, getCurrentRender } =
    createRenderStream<
      useSuspenseQuery.Result<TData, TVariables> | { error: ErrorLike }
    >();

  const utils = await render(<App props={options.initialProps} />, options);

  function rerender(props: Props) {
    return utils.rerender(<App props={props} />);
  }

  function getCurrentSnapshot() {
    const { snapshot } = getCurrentRender();

    invariant("data" in snapshot, "Snapshot is not a hook snapshot");

    return snapshot;
  }

  return { getCurrentSnapshot, takeRender, rerender };
}

test("refetches the query when a source emits", async () => {
  const client = setupClient();

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
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

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
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
    () => useSuspenseQuery(query, { refetchOn: false }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
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
    () => useSuspenseQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
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
    () => useSuspenseQuery(query, { refetchOn: true }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();
    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
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
    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
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
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query, { refetchOn }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
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
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query, { refetchOn: { test: false } }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
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
