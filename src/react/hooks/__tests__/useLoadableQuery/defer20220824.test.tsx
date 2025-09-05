import { screen } from "@testing-library/react";
import type {
  AsyncRenderFn,
  RenderStream,
} from "@testing-library/react-render-stream";
import {
  createRenderStream,
  disableActEnvironment,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import { userEvent } from "@testing-library/user-event";
import React, { Suspense } from "react";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";

import type { DataState, TypedDocumentNode } from "@apollo/client";
import { ApolloClient, gql, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { Defer20220824Handler } from "@apollo/client/incremental";
import type { QueryRef } from "@apollo/client/react";
import {
  ApolloProvider,
  useLoadableQuery,
  useReadQuery,
} from "@apollo/client/react";
import {
  mockDefer20220824,
  renderAsync,
  spyOnConsole,
} from "@apollo/client/testing/internal";
import type { DeepPartial } from "@apollo/client/utilities";

function createDefaultProfiler<TData>() {
  return createRenderStream({
    initialSnapshot: {
      error: null as Error | null,
      result: null as useReadQuery.Result<TData> | null,
    },
    skipNonTrackingRenders: true,
  });
}

function createDefaultProfiledComponents<
  Snapshot extends {
    result: useReadQuery.Result<any> | null;
    error?: Error | null;
  },
  TData = Snapshot["result"] extends useReadQuery.Result<infer TData> | null ?
    TData
  : unknown,
  TStates extends DataState<TData>["dataState"] = Snapshot["result"] extends (
    useReadQuery.Result<any, infer TStates> | null
  ) ?
    TStates
  : "complete" | "streaming",
>(profiler: RenderStream<Snapshot>) {
  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook({
    queryRef,
  }: {
    queryRef: QueryRef<TData, any, TStates>;
  }) {
    useTrackRenders();
    profiler.mergeSnapshot({
      result: useReadQuery(queryRef),
    } as unknown as Partial<Snapshot>);

    return null;
  }

  function ErrorFallback({ error }: { error: Error }) {
    useTrackRenders();
    profiler.mergeSnapshot({ error } as Partial<Snapshot>);

    return <div>Oops</div>;
  }

  function ErrorBoundary({ children }: { children: React.ReactNode }) {
    return (
      <ReactErrorBoundary FallbackComponent={ErrorFallback}>
        {children}
      </ReactErrorBoundary>
    );
  }

  return {
    SuspenseFallback,
    ReadQueryHook,
    ErrorFallback,
    ErrorBoundary,
  };
}

async function renderWithClient(
  ui: React.ReactElement,
  options: { client: ApolloClient },
  { render: doRender }: { render: AsyncRenderFn | typeof renderAsync }
) {
  const { client } = options;
  const user = userEvent.setup();

  const utils = await doRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <ApolloProvider client={client}>{children}</ApolloProvider>
    ),
  });

  return { ...utils, user };
}

test('does not suspend deferred queries with data in the cache and using a "cache-and-network" fetch policy', async () => {
  interface Data {
    greeting: {
      __typename: string;
      message: string;
      recipient: { name: string; __typename: string };
    };
  }

  const query: TypedDocumentNode<Data, Record<string, never>> = gql`
    query {
      greeting {
        message
        ... @defer {
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
  const renderStream = createDefaultProfiler<Data>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(query, {
      fetchPolicy: "cache-and-network",
    });
    return (
      <div>
        <button onClick={() => loadQuery()}>Load todo</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </div>
    );
  }

  const { user } = await renderWithClient(
    <App />,
    {
      client,
    },
    { render: renderAsync }
  );

  // initial render
  await renderStream.takeRender();

  await user.click(screen.getByText("Load todo"));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);

    expect(snapshot.result).toStrictEqualTyped({
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
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
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
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
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

  await expect(renderStream).not.toRerender();
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

  const query: TypedDocumentNode<QueryData, Record<string, never>> = gql`
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

  {
    // We are intentionally writing partial data to the cache. Supress console
    // warnings to avoid unnecessary noise in the test.
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
  const renderStream = createDefaultProfiler<DeepPartial<QueryData>>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadTodo, queryRef] = useLoadableQuery(query, {
      fetchPolicy: "cache-first",
      returnPartialData: true,
    });

    return (
      <div>
        <button onClick={() => loadTodo()}>Load todo</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </div>
    );
  }

  const { user } = await renderWithClient(
    <App />,
    {
      client,
    },
    { render: renderAsync }
  );

  // initial render
  await renderStream.takeRender();

  await user.click(screen.getByText("Load todo"));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
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
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
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
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
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

  await expect(renderStream).not.toRerender();
});
