import type { RenderOptions } from "@testing-library/react";
import {
  createRenderStream,
  disableActEnvironment,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import React, { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import type {
  DataState,
  ErrorLike,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";
import { ApolloClient, gql, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { Defer20220824Handler } from "@apollo/client/incremental";
import type { QueryRef } from "@apollo/client/react";
import { useBackgroundQuery, useReadQuery } from "@apollo/client/react";
import {
  createClientWrapper,
  mockDefer20220824,
  spyOnConsole,
} from "@apollo/client/testing/internal";

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
    replaceSnapshot(useReadQuery(queryRef) as any);

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
          onError={(error) => replaceSnapshot({ error })}
        >
          <UseReadQuery queryRef={queryRef} />
        </ErrorBoundary>
      </Suspense>
    );
  }

  const { render, takeRender, replaceSnapshot } = createRenderStream<
    useReadQuery.Result<TData, TStates> | { error: ErrorLike }
  >();

  const utils = await render(<App props={options.initialProps} />, options);

  function rerender(props: Props) {
    return utils.rerender(<App props={props} />);
  }

  return { takeRender, rerender };
}

test('does not suspend deferred queries with data in the cache and using a "cache-and-network" fetch policy', async () => {
  interface Data {
    greeting: {
      __typename: string;
      message: string;
      recipient: { name: string; __typename: string };
    };
  }

  const query: TypedDocumentNode<Data> = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDefer20220824();

  const cache = new InMemoryCache();
  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello cached",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
  });
  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useBackgroundQuery(query, { fetchPolicy: "cache-and-network" }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([
      "useBackgroundQuery",
      "useReadQuery",
    ]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello cached",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  enqueueInitialChunk({
    data: {
      greeting: { __typename: "Greeting", message: "Hello world" },
    },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
      dataState: "streaming",
      error: undefined,
      networkStatus: NetworkStatus.streaming,
    });
  }

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: { name: "Alice", __typename: "Person" },
          __typename: "Greeting",
        },
        path: ["greeting"],
      },
    ],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Alice" },
        },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(takeRender).not.toRerender();
});

test('does not suspend deferred queries with partial data in the cache and using a "cache-first" fetch policy with `returnPartialData`', async () => {
  interface QueryData {
    greeting: {
      __typename: string;
      message?: string;
      recipient?: {
        __typename: string;
        name: string;
      };
    };
  }

  const query: TypedDocumentNode<QueryData> = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDefer20220824();

  const cache = new InMemoryCache();

  // We are intentionally writing partial data to the cache. Supress console
  // warnings to avoid unnecessary noise in the test.
  {
    using _consoleSpy = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
    });
  }

  const client = new ApolloClient({
    link: httpLink,
    cache,
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () =>
      useBackgroundQuery(query, {
        fetchPolicy: "cache-first",
        returnPartialData: true,
      }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([
      "useBackgroundQuery",
      "useReadQuery",
    ]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
      dataState: "partial",
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  enqueueInitialChunk({
    data: {
      greeting: { message: "Hello world", __typename: "Greeting" },
    },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
      dataState: "streaming",
      error: undefined,
      networkStatus: NetworkStatus.streaming,
    });
  }

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          recipient: { name: "Alice", __typename: "Person" },
        },
        path: ["greeting"],
      },
    ],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Alice" },
        },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(takeRender).not.toRerender();
});
