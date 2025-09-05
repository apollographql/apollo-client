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
import { GraphQL17Alpha9Handler } from "@apollo/client/incremental";
import type { QueryRef } from "@apollo/client/react";
import { useLoadableQuery, useReadQuery } from "@apollo/client/react";
import {
  createClientWrapper,
  mockDeferStreamGraphQL17Alpha9,
  spyOnConsole,
} from "@apollo/client/testing/internal";
import { invariant } from "@apollo/client/utilities/invariant";

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

  const {
    render,
    getCurrentRender,
    takeRender,
    mergeSnapshot,
    replaceSnapshot,
  } = createRenderStream<
    | {
        loadQuery: useLoadableQuery.LoadQueryFunction<TVariables>;
        result?: useReadQuery.Result<TData, TStates>;
      }
    | { error: ErrorLike }
  >({ initialSnapshot: { loadQuery: null as any } });

  const utils = await render(<App props={options.initialProps} />, options);

  function rerender(props: Props) {
    return utils.rerender(<App props={props} />);
  }

  function getCurrentSnapshot() {
    const { snapshot } = getCurrentRender();
    invariant(
      "loadQuery" in snapshot,
      "Expected rendered hook instead of error boundary"
    );

    return snapshot;
  }

  return { takeRender, rerender, getCurrentSnapshot };
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
    mockDeferStreamGraphQL17Alpha9();

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
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderHook(
    () => useLoadableQuery(query, { fetchPolicy: "cache-and-network" }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  getCurrentSnapshot().loadQuery();

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual([
      "useLoadableQuery",
      "useReadQuery",
    ]);
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
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
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
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
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
    mockDeferStreamGraphQL17Alpha9();

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
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderHook(
    () =>
      useLoadableQuery(query, {
        fetchPolicy: "cache-first",
        returnPartialData: true,
      }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  getCurrentSnapshot().loadQuery();

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual([
      "useLoadableQuery",
      "useReadQuery",
    ]);
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
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
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
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
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

  await expect(takeRender).not.toRerender();
});