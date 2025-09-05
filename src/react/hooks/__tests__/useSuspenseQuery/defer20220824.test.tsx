import type { RenderOptions } from "@testing-library/react";
import {
  createRenderStream,
  disableActEnvironment,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import React, { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { delay, of, throwError } from "rxjs";

import type { ErrorLike, OperationVariables } from "@apollo/client";
import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  gql,
  InMemoryCache,
  NetworkStatus,
} from "@apollo/client";
import { Defer20220824Handler } from "@apollo/client/incremental";
import { ApolloProvider, useSuspenseQuery } from "@apollo/client/react";
import {
  markAsStreaming,
  mockDefer20220824,
  spyOnConsole,
  wait,
} from "@apollo/client/testing/internal";
import { offsetLimitPagination } from "@apollo/client/utilities";
import { invariant } from "@apollo/client/utilities/invariant";

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

test("suspends deferred queries until initial chunk loads then streams in data as it loads", async () => {
  const query = gql`
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

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        greeting: { message: "Hello world", __typename: "Greeting" },
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
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

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Alice" },
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});

test.each<useSuspenseQuery.FetchPolicy>([
  "cache-first",
  "network-only",
  "no-cache",
  "cache-and-network",
])(
  'suspends deferred queries until initial chunk loads then streams in data as it loads when using a "%s" fetch policy',
  async (fetchPolicy) => {
    const query = gql`
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

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: httpLink,
      incrementalHandler: new Defer20220824Handler(),
    });

    using _disabledAct = disableActEnvironment();
    const { takeRender } = await renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    {
      const { renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
    }

    enqueueInitialChunk({
      data: {
        greeting: { message: "Hello world", __typename: "Greeting" },
      },
      hasNext: true,
    });

    {
      const { snapshot, renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
      expect(snapshot).toStrictEqualTyped({
        data: markAsStreaming({
          greeting: { message: "Hello world", __typename: "Greeting" },
        }),
        dataState: "streaming",
        networkStatus: NetworkStatus.streaming,
        error: undefined,
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

      expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
      expect(snapshot).toStrictEqualTyped({
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "Person", name: "Alice" },
          },
        },
        dataState: "complete",
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    }

    await expect(takeRender).not.toRerender();
  }
);

test('does not suspend deferred queries with data in the cache and using a "cache-first" fetch policy', async () => {
  const query = gql`
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

  const cache = new InMemoryCache();

  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: ApolloLink.empty(),
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query, { fetchPolicy: "cache-first" }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const { snapshot, renderedComponents } = await takeRender();

  expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
  expect(snapshot).toStrictEqualTyped({
    data: {
      greeting: {
        message: "Hello world",
        __typename: "Greeting",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    dataState: "complete",
    networkStatus: NetworkStatus.ready,
    error: undefined,
  });

  await expect(takeRender).not.toRerender();
});

test('does not suspend deferred queries with partial data in the cache and using a "cache-first" fetch policy with `returnPartialData`', async () => {
  const query = gql`
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
    cache,
    link: httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () =>
      useSuspenseQuery(query, {
        fetchPolicy: "cache-first",
        returnPartialData: true,
      }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
      dataState: "partial",
      networkStatus: NetworkStatus.loading,
      error: undefined,
    });
  }

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
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

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Alice" },
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});

test('does not suspend deferred queries with data in the cache and using a "cache-and-network" fetch policy', async () => {
  const query = gql`
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

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });

  client.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello cached",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query, { fetchPolicy: "cache-and-network" }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        greeting: {
          message: "Hello cached",
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.loading,
      error: undefined,
    });
  }

  enqueueInitialChunk({
    data: { greeting: { __typename: "Greeting", message: "Hello world" } },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
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

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Alice" },
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});

test("suspends deferred queries with lists and properly patches results", async () => {
  const query = gql`
    query {
      greetings {
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

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  enqueueInitialChunk({
    data: {
      greetings: [
        { __typename: "Greeting", message: "Hello world" },
        { __typename: "Greeting", message: "Hello again" },
      ],
    },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        greetings: [
          { __typename: "Greeting", message: "Hello world" },
          { __typename: "Greeting", message: "Hello again" },
        ],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Alice" },
        },
        path: ["greetings", 0],
      },
    ],
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        greetings: [
          {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "Person", name: "Alice" },
          },
          {
            __typename: "Greeting",
            message: "Hello again",
          },
        ],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Bob" },
        },
        path: ["greetings", 1],
      },
    ],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        greetings: [
          {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "Person", name: "Alice" },
          },
          {
            __typename: "Greeting",
            message: "Hello again",
            recipient: { __typename: "Person", name: "Bob" },
          },
        ],
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});

test("suspends queries with deferred fragments in lists and properly merges arrays", async () => {
  const query = gql`
    query DeferVariation {
      allProducts {
        delivery {
          ...MyFragment @defer
        }
        sku
        id
      }
    }

    fragment MyFragment on DeliveryEstimates {
      estimatedDelivery
      fastestDelivery
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDefer20220824();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  enqueueInitialChunk({
    data: {
      allProducts: [
        {
          __typename: "Product",
          delivery: {
            __typename: "DeliveryEstimates",
          },
          id: "apollo-federation",
          sku: "federation",
        },
        {
          __typename: "Product",
          delivery: {
            __typename: "DeliveryEstimates",
          },
          id: "apollo-studio",
          sku: "studio",
        },
      ],
    },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        allProducts: [
          {
            __typename: "Product",
            delivery: {
              __typename: "DeliveryEstimates",
            },
            id: "apollo-federation",
            sku: "federation",
          },
          {
            __typename: "Product",
            delivery: {
              __typename: "DeliveryEstimates",
            },
            id: "apollo-studio",
            sku: "studio",
          },
        ],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  enqueueSubsequentChunk({
    hasNext: false,
    incremental: [
      {
        data: {
          __typename: "DeliveryEstimates",
          estimatedDelivery: "6/25/2021",
          fastestDelivery: "6/24/2021",
        },
        path: ["allProducts", 0, "delivery"],
      },
      {
        data: {
          __typename: "DeliveryEstimates",
          estimatedDelivery: "6/25/2021",
          fastestDelivery: "6/24/2021",
        },
        path: ["allProducts", 1, "delivery"],
      },
    ],
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        allProducts: [
          {
            __typename: "Product",
            delivery: {
              __typename: "DeliveryEstimates",
              estimatedDelivery: "6/25/2021",
              fastestDelivery: "6/24/2021",
            },
            id: "apollo-federation",
            sku: "federation",
          },
          {
            __typename: "Product",
            delivery: {
              __typename: "DeliveryEstimates",
              estimatedDelivery: "6/25/2021",
              fastestDelivery: "6/24/2021",
            },
            id: "apollo-studio",
            sku: "studio",
          },
        ],
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});

test("incrementally rerenders data returned by a `refetch` for a deferred query", async () => {
  const query = gql`
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

  const client = new ApolloClient({
    link: httpLink,
    cache: new InMemoryCache(),
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderSuspenseHook(
    () => useSuspenseQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  enqueueInitialChunk({
    data: { greeting: { __typename: "Greeting", message: "Hello world" } },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
        },
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: { name: "Alice", __typename: "Person" },
        },
        path: ["greeting"],
      },
    ],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: {
            __typename: "Person",
            name: "Alice",
          },
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  const refetchPromise = getCurrentSnapshot().refetch();

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Goodbye",
      },
    },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        greeting: {
          __typename: "Greeting",
          message: "Goodbye",
          recipient: {
            __typename: "Person",
            name: "Alice",
          },
        },
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: { name: "Bob", __typename: "Person" },
        },
        path: ["greeting"],
      },
    ],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Goodbye",
          recipient: {
            __typename: "Person",
            name: "Bob",
          },
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(refetchPromise).resolves.toStrictEqualTyped({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Goodbye",
        recipient: {
          __typename: "Person",
          name: "Bob",
        },
      },
    },
  });
});

test("incrementally renders data returned after skipping a deferred query", async () => {
  const query = gql`
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

  const client = new ApolloClient({
    link: httpLink,
    cache: new InMemoryCache(),
    incrementalHandler: new Defer20220824Handler(),
  });

  using __disabledAct = disableActEnvironment();
  const { takeRender, rerender } = await renderSuspenseHook(
    ({ skip }) => useSuspenseQuery(query, { skip }),
    {
      initialProps: { skip: true },
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await rerender({ skip: false });

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  enqueueInitialChunk({
    data: { greeting: { __typename: "Greeting", message: "Hello world" } },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
        },
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: { name: "Alice", __typename: "Person" },
        },
        path: ["greeting"],
      },
    ],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: {
            __typename: "Person",
            name: "Alice",
          },
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});

// TODO: This test is a bit of a lie. `fetchMore` should incrementally
// rerender when using `@defer` but there is currently a bug in the core
// implementation that prevents updates until the final result is returned.
// This test reflects the behavior as it exists today, but will need
// to be updated once the core bug is fixed.
//
// NOTE: A duplicate it.failng test has been added right below this one with
// the expected behavior added in (i.e. the commented code in this test). Once
// the core bug is fixed, this test can be removed in favor of the other test.
//
// https://github.com/apollographql/apollo-client/issues/11034
test("rerenders data returned by `fetchMore` for a deferred query", async () => {
  const query = gql`
    query ($offset: Int) {
      greetings(offset: $offset) {
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

  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          greetings: offsetLimitPagination(),
        },
      },
    },
  });

  const client = new ApolloClient({
    link: httpLink,
    cache,
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderSuspenseHook(
    () => useSuspenseQuery(query, { variables: { offset: 0 } }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  enqueueInitialChunk({
    data: {
      greetings: [{ __typename: "Greeting", message: "Hello world" }],
    },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        greetings: [{ __typename: "Greeting", message: "Hello world" }],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: { name: "Alice", __typename: "Person" },
        },
        path: ["greetings", 0],
      },
    ],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        greetings: [
          {
            __typename: "Greeting",
            message: "Hello world",
            recipient: {
              __typename: "Person",
              name: "Alice",
            },
          },
        ],
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  const fetchMorePromise = getCurrentSnapshot().fetchMore({
    variables: { offset: 1 },
  });

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  enqueueInitialChunk({
    data: {
      greetings: [
        {
          __typename: "Greeting",
          message: "Goodbye",
        },
      ],
    },
    hasNext: true,
  });

  // TODO: Re-enable once the core bug is fixed
  // {
  //   const { snapshot, renderedComponents } = await takeRender();
  //
  //   expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
  //   expect(snapshot).toStrictEqualTyped({
  //     data: markAsStreaming({
  //       greetings: [
  //         {
  //           __typename: "Greeting",
  //           message: "Hello world",
  //           recipient: {
  //             __typename: "Person",
  //             name: "Alice",
  //           },
  //         },
  //         {
  //           __typename: "Greeting",
  //           message: "Goodbye",
  //         },
  //       ],
  //     }),
  //     dataState: "streaming",
  //     networkStatus: NetworkStatus.streaming,
  //     error: undefined,
  //   });
  // }

  await wait(0);
  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: { name: "Bob", __typename: "Person" },
        },
        path: ["greetings", 0],
      },
    ],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        greetings: [
          {
            __typename: "Greeting",
            message: "Hello world",
            recipient: {
              __typename: "Person",
              name: "Alice",
            },
          },
          {
            __typename: "Greeting",
            message: "Goodbye",
            recipient: {
              __typename: "Person",
              name: "Bob",
            },
          },
        ],
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(fetchMorePromise).resolves.toStrictEqualTyped({
    data: {
      greetings: [
        {
          __typename: "Greeting",
          message: "Goodbye",
          recipient: {
            __typename: "Person",
            name: "Bob",
          },
        },
      ],
    },
  });

  await expect(takeRender).not.toRerender();
});

// TODO: This is a duplicate of the test above, but with the expected behavior
// added (hence the `it.failing`). Remove the previous test once issue #11034
// is fixed.
//
// https://github.com/apollographql/apollo-client/issues/11034
it.failing(
  "incrementally rerenders data returned by a `fetchMore` for a deferred query",
  async () => {
    const query = gql`
      query ($offset: Int) {
        greetings(offset: $offset) {
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

    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            greetings: offsetLimitPagination(),
          },
        },
      },
    });

    const client = new ApolloClient({
      link: httpLink,
      cache,
      incrementalHandler: new Defer20220824Handler(),
    });

    using _disabledAct = disableActEnvironment();
    const { takeRender, getCurrentSnapshot } = await renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { offset: 0 } }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    {
      const { renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
    }

    enqueueInitialChunk({
      data: {
        greetings: [{ __typename: "Greeting", message: "Hello world" }],
      },
      hasNext: true,
    });

    {
      const { snapshot, renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
      expect(snapshot).toStrictEqualTyped({
        data: markAsStreaming({
          greetings: [{ __typename: "Greeting", message: "Hello world" }],
        }),
        dataState: "streaming",
        networkStatus: NetworkStatus.streaming,
        error: undefined,
      });
    }

    enqueueSubsequentChunk({
      incremental: [
        {
          data: {
            recipient: { name: "Alice", __typename: "Person" },
          },
          path: ["greetings", 0],
        },
      ],
      hasNext: false,
    });

    {
      const { snapshot, renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
      expect(snapshot).toStrictEqualTyped({
        data: {
          greetings: [
            {
              __typename: "Greeting",
              message: "Hello world",
              recipient: {
                __typename: "Person",
                name: "Alice",
              },
            },
          ],
        },
        dataState: "complete",
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    }

    const fetchMorePromise = getCurrentSnapshot().fetchMore({
      variables: { offset: 1 },
    });

    {
      const { renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
    }

    enqueueInitialChunk({
      data: {
        greetings: [
          {
            __typename: "Greeting",
            message: "Goodbye",
          },
        ],
      },
      hasNext: true,
    });

    {
      const { snapshot, renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
      expect(snapshot).toStrictEqualTyped({
        data: markAsStreaming({
          greetings: [
            {
              __typename: "Greeting",
              message: "Hello world",
              recipient: {
                __typename: "Person",
                name: "Alice",
              },
            },
            {
              __typename: "Greeting",
              message: "Goodbye",
            },
          ],
        }),
        dataState: "streaming",
        networkStatus: NetworkStatus.streaming,
        error: undefined,
      });
    }

    enqueueSubsequentChunk({
      incremental: [
        {
          data: {
            recipient: { name: "Bob", __typename: "Person" },
          },
          path: ["greetings", 0],
        },
      ],
      hasNext: false,
    });

    {
      const { snapshot, renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
      expect(snapshot).toStrictEqualTyped({
        data: {
          greetings: [
            {
              __typename: "Greeting",
              message: "Hello world",
              recipient: {
                __typename: "Person",
                name: "Alice",
              },
            },
            {
              __typename: "Greeting",
              message: "Goodbye",
              recipient: {
                __typename: "Person",
                name: "Bob",
              },
            },
          ],
        },
        dataState: "complete",
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    }

    await expect(fetchMorePromise!).resolves.toStrictEqualTyped({
      data: {
        greetings: [
          {
            __typename: "Greeting",
            message: "Goodbye",
            recipient: {
              __typename: "Person",
              name: "Bob",
            },
          },
        ],
      },
    });

    await expect(takeRender).not.toRerender();
  }
);

test("throws network errors returned by deferred queries", async () => {
  using _consoleSpy = spyOnConsole("error");

  const query = gql`
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

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(() => {
      return throwError(() => new Error("Could not fetch")).pipe(delay(20));
    }),
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["ErrorBoundary"]);
    expect(snapshot).toStrictEqualTyped({
      error: new Error("Could not fetch"),
    });
  }

  await expect(takeRender).not.toRerender();
});

test("throws graphql errors returned by deferred queries", async () => {
  using _consoleSpy = spyOnConsole("error");

  const query = gql`
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

  const { httpLink, enqueueInitialChunk } = mockDefer20220824();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  enqueueInitialChunk({
    errors: [{ message: "Could not fetch greeting" }],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["ErrorBoundary"]);
    expect(snapshot).toStrictEqualTyped({
      error: new CombinedGraphQLErrors({
        data: null,
        errors: [{ message: "Could not fetch greeting" }],
      }),
    });
  }

  await expect(takeRender).not.toRerender();
});

test("throws errors returned by deferred queries that include partial data", async () => {
  using _consoleSpy = spyOnConsole("error");

  const query = gql`
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

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(() => {
      return of({
        data: { greeting: null },
        errors: [{ message: "Could not fetch greeting" }],
      }).pipe(delay(20));
    }),
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["ErrorBoundary"]);
    expect(snapshot).toStrictEqualTyped({
      error: new CombinedGraphQLErrors({
        data: { greeting: null },
        errors: [{ message: "Could not fetch greeting" }],
      }),
    });
  }

  await expect(takeRender).not.toRerender();
});

test("discards partial data and throws errors returned in incremental chunks", async () => {
  using _consoleSpy = spyOnConsole("error");

  const query = gql`
    query {
      hero {
        name
        heroFriends {
          id
          name
          ... @defer {
            homeWorld
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDefer20220824();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  enqueueInitialChunk({
    data: {
      hero: {
        name: "R2-D2",
        heroFriends: [
          {
            id: "1000",
            name: "Luke Skywalker",
          },
          {
            id: "1003",
            name: "Leia Organa",
          },
        ],
      },
    },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        hero: {
          heroFriends: [
            {
              id: "1000",
              name: "Luke Skywalker",
            },
            {
              id: "1003",
              name: "Leia Organa",
            },
          ],
          name: "R2-D2",
        },
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  enqueueSubsequentChunk({
    incremental: [
      {
        path: ["hero", "heroFriends", 0],
        errors: [
          {
            message:
              "homeWorld for character with ID 1000 could not be fetched.",
            path: ["hero", "heroFriends", 0, "homeWorld"],
          },
        ],
        data: {
          homeWorld: null,
        },
      },
      // This chunk is ignored since errorPolicy `none` throws away partial
      // data
      {
        path: ["hero", "heroFriends", 1],
        data: {
          homeWorld: "Alderaan",
        },
      },
    ],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["ErrorBoundary"]);
    expect(snapshot).toStrictEqualTyped({
      error: new CombinedGraphQLErrors({
        data: {
          hero: {
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
                homeWorld: null,
              },
              {
                id: "1003",
                name: "Leia Organa",
                homeWorld: "Alderaan",
              },
            ],
            name: "R2-D2",
          },
        },
        errors: [
          {
            message:
              "homeWorld for character with ID 1000 could not be fetched.",
            path: ["hero", "heroFriends", 0, "homeWorld"],
          },
        ],
      }),
    });
  }

  await expect(takeRender).not.toRerender();
});

test("adds partial data and does not throw errors returned in incremental chunks but returns them in `error` property with errorPolicy set to `all`", async () => {
  const query = gql`
    query {
      hero {
        name
        heroFriends {
          id
          name
          ... @defer {
            homeWorld
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDefer20220824();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query, { errorPolicy: "all" }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  enqueueInitialChunk({
    data: {
      hero: {
        name: "R2-D2",
        heroFriends: [
          {
            id: "1000",
            name: "Luke Skywalker",
          },
          {
            id: "1003",
            name: "Leia Organa",
          },
        ],
      },
    },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        hero: {
          heroFriends: [
            {
              id: "1000",
              name: "Luke Skywalker",
            },
            {
              id: "1003",
              name: "Leia Organa",
            },
          ],
          name: "R2-D2",
        },
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  enqueueSubsequentChunk({
    incremental: [
      {
        path: ["hero", "heroFriends", 0],
        errors: [
          {
            message:
              "homeWorld for character with ID 1000 could not be fetched.",
            path: ["hero", "heroFriends", 0, "homeWorld"],
          },
        ],
        data: {
          homeWorld: null,
        },
      },
      // Unlike the default (errorPolicy = `none`), this data will be
      // added to the final result
      {
        path: ["hero", "heroFriends", 1],
        data: {
          homeWorld: "Alderaan",
        },
      },
    ],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        hero: {
          heroFriends: [
            {
              id: "1000",
              name: "Luke Skywalker",
              homeWorld: null,
            },
            {
              id: "1003",
              name: "Leia Organa",
              homeWorld: "Alderaan",
            },
          ],
          name: "R2-D2",
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.error,
      error: new CombinedGraphQLErrors({
        data: {
          hero: {
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
                homeWorld: null,
              },
              {
                id: "1003",
                name: "Leia Organa",
                homeWorld: "Alderaan",
              },
            ],
            name: "R2-D2",
          },
        },
        errors: [
          {
            message:
              "homeWorld for character with ID 1000 could not be fetched.",
            path: ["hero", "heroFriends", 0, "homeWorld"],
          },
        ],
      }),
    });
  }

  await expect(takeRender).not.toRerender();
});

test("adds partial data and discards errors returned in incremental chunks with errorPolicy set to `ignore`", async () => {
  const query = gql`
    query {
      hero {
        name
        heroFriends {
          id
          name
          ... @defer {
            homeWorld
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDefer20220824();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query, { errorPolicy: "ignore" }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  enqueueInitialChunk({
    data: {
      hero: {
        name: "R2-D2",
        heroFriends: [
          {
            id: "1000",
            name: "Luke Skywalker",
          },
          {
            id: "1003",
            name: "Leia Organa",
          },
        ],
      },
    },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        hero: {
          heroFriends: [
            {
              id: "1000",
              name: "Luke Skywalker",
            },
            {
              id: "1003",
              name: "Leia Organa",
            },
          ],
          name: "R2-D2",
        },
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  enqueueSubsequentChunk({
    incremental: [
      {
        path: ["hero", "heroFriends", 0],
        errors: [
          {
            message:
              "homeWorld for character with ID 1000 could not be fetched.",
            path: ["hero", "heroFriends", 0, "homeWorld"],
          },
        ],
        data: {
          homeWorld: null,
        },
      },
      {
        path: ["hero", "heroFriends", 1],
        data: {
          homeWorld: "Alderaan",
        },
      },
    ],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        hero: {
          heroFriends: [
            {
              id: "1000",
              name: "Luke Skywalker",
              homeWorld: null,
            },
            {
              id: "1003",
              name: "Leia Organa",
              homeWorld: "Alderaan",
            },
          ],
          name: "R2-D2",
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});

test("can refetch and respond to cache updates after encountering an error in an incremental chunk for a deferred query when `errorPolicy` is `all`", async () => {
  const query = gql`
    query {
      hero {
        name
        heroFriends {
          id
          name
          ... @defer {
            homeWorld
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDefer20220824();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderSuspenseHook(
    () => useSuspenseQuery(query, { errorPolicy: "all" }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  enqueueInitialChunk({
    data: {
      hero: {
        name: "R2-D2",
        heroFriends: [
          { id: "1000", name: "Luke Skywalker" },
          { id: "1003", name: "Leia Organa" },
        ],
      },
    },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        hero: {
          heroFriends: [
            { id: "1000", name: "Luke Skywalker" },
            { id: "1003", name: "Leia Organa" },
          ],
          name: "R2-D2",
        },
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  enqueueSubsequentChunk({
    incremental: [
      {
        path: ["hero", "heroFriends", 0],
        errors: [
          {
            message:
              "homeWorld for character with ID 1000 could not be fetched.",
            path: ["hero", "heroFriends", 0, "homeWorld"],
          },
        ],
        data: {
          homeWorld: null,
        },
      },
      {
        path: ["hero", "heroFriends", 1],
        data: {
          homeWorld: "Alderaan",
        },
      },
    ],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        hero: {
          heroFriends: [
            { id: "1000", name: "Luke Skywalker", homeWorld: null },
            { id: "1003", name: "Leia Organa", homeWorld: "Alderaan" },
          ],
          name: "R2-D2",
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.error,
      error: new CombinedGraphQLErrors({
        data: {
          hero: {
            heroFriends: [
              { id: "1000", name: "Luke Skywalker", homeWorld: null },
              { id: "1003", name: "Leia Organa", homeWorld: "Alderaan" },
            ],
            name: "R2-D2",
          },
        },
        errors: [
          {
            message:
              "homeWorld for character with ID 1000 could not be fetched.",
            path: ["hero", "heroFriends", 0, "homeWorld"],
          },
        ],
      }),
    });
  }

  const refetchPromise = getCurrentSnapshot().refetch();

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  enqueueInitialChunk({
    data: {
      hero: {
        name: "R2-D2",
        heroFriends: [
          { id: "1000", name: "Luke Skywalker" },
          { id: "1003", name: "Leia Organa" },
        ],
      },
    },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        hero: {
          heroFriends: [
            { id: "1000", name: "Luke Skywalker", homeWorld: null },
            { id: "1003", name: "Leia Organa", homeWorld: "Alderaan" },
          ],
          name: "R2-D2",
        },
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  enqueueSubsequentChunk({
    incremental: [
      {
        path: ["hero", "heroFriends", 0],
        data: {
          homeWorld: "Alderaan",
        },
      },
      {
        path: ["hero", "heroFriends", 1],
        data: {
          homeWorld: "Alderaan",
        },
      },
    ],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        hero: {
          heroFriends: [
            { id: "1000", name: "Luke Skywalker", homeWorld: "Alderaan" },
            { id: "1003", name: "Leia Organa", homeWorld: "Alderaan" },
          ],
          name: "R2-D2",
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(refetchPromise).resolves.toStrictEqualTyped({
    data: {
      hero: {
        heroFriends: [
          { id: "1000", name: "Luke Skywalker", homeWorld: "Alderaan" },
          { id: "1003", name: "Leia Organa", homeWorld: "Alderaan" },
        ],
        name: "R2-D2",
      },
    },
  });

  client.cache.updateQuery<any>({ query }, (data) => ({
    hero: {
      ...data.hero,
      name: "C3PO",
    },
  }));

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        hero: {
          heroFriends: [
            { id: "1000", name: "Luke Skywalker", homeWorld: "Alderaan" },
            { id: "1003", name: "Leia Organa", homeWorld: "Alderaan" },
          ],
          name: "C3PO",
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});
