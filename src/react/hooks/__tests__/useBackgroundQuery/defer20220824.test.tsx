import type { RenderStream } from "@testing-library/react-render-stream";
import {
  createRenderStream,
  disableActEnvironment,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import React, { Suspense } from "react";

import type { DataState, TypedDocumentNode } from "@apollo/client";
import { ApolloClient, gql, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { Defer20220824Handler } from "@apollo/client/incremental";
import type { QueryRef } from "@apollo/client/react";
import { useBackgroundQuery, useReadQuery } from "@apollo/client/react";
import { MockSubscriptionLink } from "@apollo/client/testing";
import {
  createClientWrapper,
  spyOnConsole,
} from "@apollo/client/testing/internal";
import type { DeepPartial } from "@apollo/client/utilities";

function createDefaultTrackedComponents<
  Snapshot extends {
    result: useReadQuery.Result<any> | null;
  },
  TData = Snapshot["result"] extends useReadQuery.Result<infer TData> | null ?
    TData
  : unknown,
  TStates extends DataState<TData>["dataState"] = Snapshot["result"] extends (
    useReadQuery.Result<any, infer TStates> | null
  ) ?
    TStates
  : "complete" | "streaming",
>(renderStream: RenderStream<Snapshot>) {
  function SuspenseFallback() {
    useTrackRenders();
    return <div>Loading</div>;
  }

  function ReadQueryHook({
    queryRef,
  }: {
    queryRef: QueryRef<TData, any, TStates>;
  }) {
    useTrackRenders();
    renderStream.mergeSnapshot({
      result: useReadQuery(queryRef),
    } as unknown as Partial<Snapshot>);

    return null;
  }

  return { SuspenseFallback, ReadQueryHook };
}

function createDefaultProfiler<TData = unknown>() {
  return createRenderStream({
    initialSnapshot: {
      result: null as useReadQuery.Result<TData> | null,
    },
  });
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

  const link = new MockSubscriptionLink();
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
    link,
    incrementalHandler: new Defer20220824Handler(),
  });

  const renderStream = createDefaultProfiler<Data>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, {
      fetchPolicy: "cache-and-network",
    });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

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

  link.simulateResult({
    result: {
      data: {
        greeting: { __typename: "Greeting", message: "Hello world" },
      },
      hasNext: true,
    },
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

  link.simulateResult(
    {
      result: {
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
      },
    },
    true
  );

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

  await expect(renderStream).not.toRerender({ timeout: 50 });
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

  const link = new MockSubscriptionLink();
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
    link,
    cache,
    incrementalHandler: new Defer20220824Handler(),
  });

  const renderStream = createDefaultProfiler<DeepPartial<QueryData>>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, {
      fetchPolicy: "cache-first",
      returnPartialData: true,
    });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

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

  link.simulateResult({
    result: {
      data: {
        greeting: { message: "Hello world", __typename: "Greeting" },
      },
      hasNext: true,
    },
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

  link.simulateResult(
    {
      result: {
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
      },
    },
    true
  );

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

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

