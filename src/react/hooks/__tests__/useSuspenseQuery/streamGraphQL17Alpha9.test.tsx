import type { RenderOptions } from "@testing-library/react";
import {
  createRenderStream,
  disableActEnvironment,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import React, { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { Subject } from "rxjs";
import { delay, from, throwError } from "rxjs";

import type { ErrorLike, OperationVariables } from "@apollo/client";
import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  gql,
  InMemoryCache,
  NetworkStatus,
} from "@apollo/client";
import { GraphQL17Alpha9Handler } from "@apollo/client/incremental";
import { useSuspenseQuery } from "@apollo/client/react";
import {
  asyncIterableSubject,
  createClientWrapper,
  executeSchemaGraphQL17Alpha9,
  friendListSchemaGraphQL17Alpha9,
  markAsStreaming,
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
    >({ skipNonTrackingRenders: true });

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

function createLink(rootValue?: unknown) {
  return new ApolloLink((operation) => {
    return from(
      executeSchemaGraphQL17Alpha9(
        friendListSchemaGraphQL17Alpha9,
        operation.query,
        rootValue
      )
    );
  });
}

const friends = [
  { name: "Luke", id: 1 },
  { name: "Han", id: 2 },
  { name: "Leia", id: 3 },
];

type Friend = (typeof friends)[number];

test("suspends streamed queries until initial chunk loads then streams in data as it loads", async () => {
  const { stream, subject } = asyncIterableSubject<Friend>();

  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: createLink({
      friendList: async () => {
        return stream;
      },
    }),
    incrementalHandler: new GraphQL17Alpha9Handler(),
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

  subject.next(friends[0]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  subject.next(friends[1]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
        ],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  subject.next(friends[2]);
  subject.complete();

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
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
  'suspends streamed queries until initial chunk loads then streams in data as it loads when using a "%s" fetch policy',
  async (fetchPolicy) => {
    const { stream, subject } = asyncIterableSubject();

    const query = gql`
      query {
        friendList @stream(initialCount: 1) {
          id
          name
        }
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: createLink({ friendList: () => stream }),
      incrementalHandler: new GraphQL17Alpha9Handler(),
    });

    using _disabledAct = disableActEnvironment();
    const { takeRender } = await renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy }),
      { wrapper: createClientWrapper(client) }
    );

    {
      const { renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
    }

    subject.next(friends[0]);

    {
      const { snapshot, renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
      expect(snapshot).toStrictEqualTyped({
        data: markAsStreaming({
          friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
        }),
        dataState: "streaming",
        networkStatus: NetworkStatus.streaming,
        error: undefined,
      });
    }

    subject.next(friends[1]);

    {
      const { snapshot, renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
      expect(snapshot).toStrictEqualTyped({
        data: markAsStreaming({
          friendList: [
            { __typename: "Friend", id: "1", name: "Luke" },
            { __typename: "Friend", id: "2", name: "Han" },
          ],
        }),
        dataState: "streaming",
        networkStatus: NetworkStatus.streaming,
        error: undefined,
      });
    }

    subject.next(friends[2]);
    subject.complete();

    {
      const { snapshot, renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
      expect(snapshot).toStrictEqualTyped({
        data: {
          friendList: [
            { __typename: "Friend", id: "1", name: "Luke" },
            { __typename: "Friend", id: "2", name: "Han" },
            { __typename: "Friend", id: "3", name: "Leia" },
          ],
        },
        dataState: "complete",
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    }

    await expect(takeRender).not.toRerender();
  }
);

test('does not suspend streamed queries with data in the cache and using a "cache-first" fetch policy', async () => {
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const cache = new InMemoryCache();

  cache.writeQuery({
    // Use a query without `@stream` to ensure it doesn't affect the cache
    query: gql`
      query {
        friendList {
          id
          name
        }
      }
    `,
    data: {
      friendList: friends.map((friend) => ({
        __typename: "Friend",
        ...friend,
      })),
    },
  });

  const client = new ApolloClient({
    cache,
    link: ApolloLink.empty(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query, { fetchPolicy: "cache-first" }),
    {
      wrapper: createClientWrapper(client),
    }
  );

  const { snapshot, renderedComponents } = await takeRender();

  expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
  expect(snapshot).toStrictEqualTyped({
    data: {
      friendList: friends.map((friend) => ({
        __typename: "Friend",
        ...friend,
      })),
    },
    dataState: "complete",
    networkStatus: NetworkStatus.ready,
    error: undefined,
  });

  await expect(takeRender).not.toRerender();
});

// TODO: Determine how we handle partial data with streamed responses. While this
// works as expected and renders correctly, this also emits missing field
// warnings in the console when writing the result to the cache since array items
// with partial cache data are still included for items that haven't streamed in
// yet.
test('does not suspend streamed queries with partial data in the cache and using a "cache-first" fetch policy with `returnPartialData`', async () => {
  using _TODO_REMOVE_ME_AFTER_DECIDING_COMMENT = spyOnConsole("error");
  const { subject, stream } = asyncIterableSubject();

  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const cache = new InMemoryCache();

  // We are intentionally writing partial data to the cache. Supress console
  // warnings to avoid unnecessary noise in the test.
  {
    // using _consoleSpy = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        friendList: friends.map((friend) => ({
          __typename: "Friend",
          id: String(friend.id),
        })),
      },
    });
  }

  const client = new ApolloClient({
    cache,
    link: createLink({ friendList: () => stream }),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () =>
      useSuspenseQuery(query, {
        fetchPolicy: "cache-first",
        returnPartialData: true,
      }),
    {
      wrapper: createClientWrapper(client),
    }
  );

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: friends.map((friend) => ({
          __typename: "Friend",
          id: String(friend.id),
        })),
      },
      dataState: "partial",
      networkStatus: NetworkStatus.loading,
      error: undefined,
    });
  }

  subject.next(friends[0]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2" },
          { __typename: "Friend", id: "3" },
        ],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  subject.next(friends[1]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3" },
        ],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  subject.next(friends[2]);
  subject.complete();

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      }),
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});

test('does not suspend streamed queries with data in the cache and using a "cache-and-network" fetch policy', async () => {
  const { stream, subject } = asyncIterableSubject();
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: createLink({ friendList: () => stream }),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  client.writeQuery({
    query,
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Cached Luke" },
        { __typename: "Friend", id: "2", name: "Cached Han" },
        { __typename: "Friend", id: "3", name: "Cached Leia" },
      ],
    },
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query, { fetchPolicy: "cache-and-network" }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Cached Luke" },
          { __typename: "Friend", id: "2", name: "Cached Han" },
          { __typename: "Friend", id: "3", name: "Cached Leia" },
        ],
      },
      dataState: "complete",
      networkStatus: NetworkStatus.loading,
      error: undefined,
    });
  }

  subject.next(friends[0]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Cached Han" },
          { __typename: "Friend", id: "3", name: "Cached Leia" },
        ],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  subject.next(friends[1]);
  subject.next(friends[2]);
  subject.complete();

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});

test("incrementally rerenders data returned by a `refetch` for a streamed query", async () => {
  let subject!: Subject<Friend>;
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    link: createLink({
      friendList: () => {
        const iterable = asyncIterableSubject<Friend>();
        subject = iterable.subject;

        return iterable.stream;
      },
    }),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderSuspenseHook(
    () => useSuspenseQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  subject.next(friends[0]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  subject.next(friends[1]);
  subject.next(friends[2]);
  subject.complete();

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
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

  subject.next({ id: 1, name: "Luke (refetch)" });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke (refetch)" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  subject.next({ id: 2, name: "Han (refetch)" });
  subject.next({ id: 3, name: "Leia (refetch)" });
  subject.complete();

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke (refetch)" },
          { __typename: "Friend", id: "2", name: "Han (refetch)" },
          { __typename: "Friend", id: "3", name: "Leia (refetch)" },
        ],
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(refetchPromise).resolves.toStrictEqualTyped({
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke (refetch)" },
        { __typename: "Friend", id: "2", name: "Han (refetch)" },
        { __typename: "Friend", id: "3", name: "Leia (refetch)" },
      ],
    },
  });
});

test("incrementally renders data returned after skipping a streamed query", async () => {
  const { stream, subject } = asyncIterableSubject();
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    link: createLink({ friendList: () => stream }),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  using __disabledAct = disableActEnvironment();
  const { takeRender, rerender } = await renderSuspenseHook(
    ({ skip }) => useSuspenseQuery(query, { skip }),
    {
      initialProps: { skip: true },
      wrapper: createClientWrapper(client),
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

  subject.next(friends[0]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  subject.next(friends[1]);
  subject.next(friends[2]);
  subject.complete();

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});

// TODO: This test is a bit of a lie. `fetchMore` should incrementally
// rerender when using `@stream` but there is currently a bug in the core
// implementation that prevents updates until the final result is returned.
// This test reflects the behavior as it exists today, but will need
// to be updated once the core bug is fixed.
//
// NOTE: A duplicate it.failng test has been added right below this one with
// the expected behavior added in (i.e. the commented code in this test). Once
// the core bug is fixed, this test can be removed in favor of the other test.
//
// https://github.com/apollographql/apollo-client/issues/11034
test.failing(
  "rerenders data returned by `fetchMore` for a streamed query",
  async () => {
    let subject!: Subject<Friend>;
    const query = gql`
      query ($offset: Int) {
        friendList(offset: $offset) @stream(initialCount: 1) {
          id
          name
        }
      }
    `;

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
      link: createLink({
        friendList: () => {
          const iterator = asyncIterableSubject<Friend>();
          subject = iterator.subject;

          return iterator.stream;
        },
      }),
      cache,
      incrementalHandler: new GraphQL17Alpha9Handler(),
    });

    using _disabledAct = disableActEnvironment();
    const { takeRender, getCurrentSnapshot } = await renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { offset: 0 } }),
      { wrapper: createClientWrapper(client) }
    );

    {
      const { renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
    }

    subject.next(friends[0]);

    {
      const { snapshot, renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
      expect(snapshot).toStrictEqualTyped({
        data: markAsStreaming({
          friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
        }),
        dataState: "streaming",
        networkStatus: NetworkStatus.streaming,
        error: undefined,
      });
    }

    subject.next(friends[1]);
    subject.complete();

    {
      const { snapshot, renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
      expect(snapshot).toStrictEqualTyped({
        data: {
          friendList: [
            { __typename: "Friend", id: "1", name: "Luke" },
            { __typename: "Friend", id: "2", name: "Han" },
          ],
        },
        dataState: "complete",
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    }

    const fetchMorePromise = getCurrentSnapshot().fetchMore({
      variables: { offset: 2 },
    });

    {
      const { renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
    }

    subject.next(friends[2]);

    // TODO: Re-enable once the core bug is fixed
    // {
    //   const { snapshot, renderedComponents } = await takeRender();
    //
    //   expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    //   expect(snapshot).toStrictEqualTyped({
    //     data: markAsStreaming({
    //       friendList: [
    //         { __typename: "Friend", id: "1", name: "Luke" },
    //         { __typename: "Friend", id: "2", name: "Han" },
    //         { __typename: "Friend", id: "3", name: "Leia" },
    //       ],
    //     }),
    //     dataState: "streaming",
    //     networkStatus: NetworkStatus.streaming,
    //     error: undefined,
    //   });
    // }

    await wait(0);
    subject.next({ id: 4, name: "Chewbacca" });
    subject.complete();

    {
      const { snapshot, renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
      expect(snapshot).toStrictEqualTyped({
        data: {
          friendList: [
            { __typename: "Friend", id: "1", name: "Luke" },
            { __typename: "Friend", id: "2", name: "Han" },
            { __typename: "Friend", id: "3", name: "Leia" },
            { __typename: "Friend", id: "4", name: "Chewbacca" },
          ],
        },
        dataState: "complete",
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    }

    await expect(fetchMorePromise).resolves.toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "3", name: "Leia" },
          { __typename: "Friend", id: "4", name: "Chewbacca" },
        ],
      },
    });

    await expect(takeRender).not.toRerender();
  }
);

// TODO: This is a duplicate of the test above, but with the expected behavior
// added (hence the `it.failing`). Remove the previous test once issue #11034
// is fixed.
//
// https://github.com/apollographql/apollo-client/issues/11034
test.failing(
  "incrementally rerenders data returned by a `fetchMore` for a streamed query",
  async () => {
    let subject!: Subject<Friend>;
    const query = gql`
      query ($offset: Int) {
        friendList(offset: $offset) @stream(initialCount: 1) {
          id
          name
        }
      }
    `;

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
      link: createLink({
        friendList: () => {
          const iterator = asyncIterableSubject<Friend>();
          subject = iterator.subject;

          return iterator.stream;
        },
      }),
      cache,
      incrementalHandler: new GraphQL17Alpha9Handler(),
    });

    using _disabledAct = disableActEnvironment();
    const { takeRender, getCurrentSnapshot } = await renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { offset: 0 } }),
      { wrapper: createClientWrapper(client) }
    );

    {
      const { renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
    }

    subject.next(friends[0]);

    {
      const { snapshot, renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
      expect(snapshot).toStrictEqualTyped({
        data: markAsStreaming({
          friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
        }),
        dataState: "streaming",
        networkStatus: NetworkStatus.streaming,
        error: undefined,
      });
    }

    subject.next(friends[1]);
    subject.complete();

    {
      const { snapshot, renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
      expect(snapshot).toStrictEqualTyped({
        data: {
          friendList: [
            { __typename: "Friend", id: "1", name: "Luke" },
            { __typename: "Friend", id: "2", name: "Han" },
          ],
        },
        dataState: "complete",
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    }

    const fetchMorePromise = getCurrentSnapshot().fetchMore({
      variables: { offset: 2 },
    });

    {
      const { renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
    }

    subject.next(friends[2]);

    {
      const { snapshot, renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
      expect(snapshot).toStrictEqualTyped({
        data: markAsStreaming({
          friendList: [
            { __typename: "Friend", id: "1", name: "Luke" },
            { __typename: "Friend", id: "2", name: "Han" },
            { __typename: "Friend", id: "3", name: "Leia" },
          ],
        }),
        dataState: "streaming",
        networkStatus: NetworkStatus.streaming,
        error: undefined,
      });
    }

    await wait(0);
    subject.next({ id: 4, name: "Chewbacca" });
    subject.complete();

    {
      const { snapshot, renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
      expect(snapshot).toStrictEqualTyped({
        data: {
          friendList: [
            { __typename: "Friend", id: "1", name: "Luke" },
            { __typename: "Friend", id: "2", name: "Han" },
            { __typename: "Friend", id: "3", name: "Leia" },
            { __typename: "Friend", id: "4", name: "Chewbacca" },
          ],
        },
        dataState: "complete",
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    }

    await expect(fetchMorePromise).resolves.toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "3", name: "Leia" },
          { __typename: "Friend", id: "4", name: "Chewbacca" },
        ],
      },
    });

    await expect(takeRender).not.toRerender();
  }
);

test("throws network errors returned by streamed queries", async () => {
  using _consoleSpy = spyOnConsole("error");

  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(() => {
      return throwError(() => new Error("Could not fetch")).pipe(delay(20));
    }),
    incrementalHandler: new GraphQL17Alpha9Handler(),
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

    expect(renderedComponents).toStrictEqual(["ErrorBoundary"]);
    expect(snapshot).toStrictEqualTyped({
      error: new Error("Could not fetch"),
    });
  }

  await expect(takeRender).not.toRerender();
});

test("throws graphql errors returned by streamed queries", async () => {
  using _consoleSpy = spyOnConsole("error");

  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: createLink({
      friendList: async () => {
        await wait(20);
        throw new Error("Could not get friend list");
      },
    }),
    incrementalHandler: new GraphQL17Alpha9Handler(),
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

    expect(renderedComponents).toStrictEqual(["ErrorBoundary"]);
    expect(snapshot).toStrictEqualTyped({
      error: new CombinedGraphQLErrors({
        data: { friendList: null },
        errors: [
          { message: "Could not get friend list", path: ["friendList"] },
        ],
      }),
    });
  }

  await expect(takeRender).not.toRerender();
});

test("discards partial data and throws errors returned in incremental chunks", async () => {
  const { stream, subject } = asyncIterableSubject<Friend>();
  using _consoleSpy = spyOnConsole("error");

  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: createLink({
      friendList: async function* () {
        for await (const friend of stream) {
          if (friend.id === 2) {
            throw new Error("Could not get friend");
          }

          yield friend;
        }
      },
    }),
    incrementalHandler: new GraphQL17Alpha9Handler(),
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

  subject.next(friends[0]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  subject.next(friends[1]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["ErrorBoundary"]);
    expect(snapshot).toStrictEqualTyped({
      error: new CombinedGraphQLErrors({
        data: {
          friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
        },
        errors: [{ message: "Could not get friend", path: ["friendList"] }],
      }),
    });
  }

  await expect(takeRender).not.toRerender();
});

test("adds partial data and does not throw errors returned in incremental chunks but returns them in `error` property with errorPolicy set to `all`", async () => {
  const { stream, subject } = asyncIterableSubject();
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: createLink({ friendList: () => stream }),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query, { errorPolicy: "all" }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  subject.next(friends[0]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  subject.next(Promise.reject(new Error("Could not get friend")));

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [{ __typename: "Friend", id: "1", name: "Luke" }, null],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: new CombinedGraphQLErrors({
        data: {
          friendList: [{ __typename: "Friend", id: "1", name: "Luke" }, null],
        },
        errors: [{ message: "Could not get friend", path: ["friendList", 1] }],
      }),
    });
  }

  subject.next(friends[2]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          null,
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: new CombinedGraphQLErrors({
        data: {
          friendList: [
            { __typename: "Friend", id: "1", name: "Luke" },
            null,
            { __typename: "Friend", id: "3", name: "Leia" },
          ],
        },
        errors: [{ message: "Could not get friend", path: ["friendList", 1] }],
      }),
    });
  }

  subject.complete();

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          null,
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      },
      dataState: "complete",
      networkStatus: NetworkStatus.error,
      error: new CombinedGraphQLErrors({
        data: {
          friendList: [
            { __typename: "Friend", id: "1", name: "Luke" },
            null,
            { __typename: "Friend", id: "3", name: "Leia" },
          ],
        },
        errors: [{ message: "Could not get friend", path: ["friendList", 1] }],
      }),
    });
  }

  await expect(takeRender).not.toRerender();
});

test("adds partial data and discards errors returned in incremental chunks with errorPolicy set to `ignore`", async () => {
  const { stream, subject } = asyncIterableSubject<Friend | Promise<Friend>>();
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: createLink({
      friendList: () => stream,
    }),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderSuspenseHook(
    () => useSuspenseQuery(query, { errorPolicy: "ignore" }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  subject.next(friends[0]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  subject.next(Promise.reject(new Error("Could not get friend")));

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [{ __typename: "Friend", id: "1", name: "Luke" }, null],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  subject.next(friends[2]);
  subject.complete();

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          null,
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});

test("can refetch and respond to cache updates after encountering an error in an incremental chunk for a streamed query when `errorPolicy` is `all`", async () => {
  let subject!: Subject<Promise<Friend> | Friend>;
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: createLink({
      friendList: async () => {
        const iterable = asyncIterableSubject<Promise<Friend> | Friend>();
        subject = iterable.subject;

        return iterable.stream;
      },
    }),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderSuspenseHook(
    () => useSuspenseQuery(query, { errorPolicy: "all" }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  subject.next(friends[0]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  subject.next(Promise.reject(new Error("Could not get friend")));

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [{ __typename: "Friend", id: "1", name: "Luke" }, null],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: new CombinedGraphQLErrors({
        data: {
          friendList: [{ __typename: "Friend", id: "1", name: "Luke" }, null],
        },
        errors: [{ message: "Could not get friend", path: ["friendList", 1] }],
      }),
    });
  }

  subject.next(friends[2]);
  subject.complete();

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          null,
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      }),
      dataState: "complete",
      networkStatus: NetworkStatus.error,
      error: new CombinedGraphQLErrors({
        data: {
          friendList: [
            { __typename: "Friend", id: "1", name: "Luke" },
            null,
            { __typename: "Friend", id: "3", name: "Leia" },
          ],
        },
        errors: [{ message: "Could not get friend", path: ["friendList", 1] }],
      }),
    });
  }

  const refetchPromise = getCurrentSnapshot().refetch();

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  subject.next(friends[0]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          null,
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  subject.next(friends[1]);

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: markAsStreaming({
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  subject.next(friends[2]);
  subject.complete();

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(refetchPromise).resolves.toStrictEqualTyped({
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    },
  });

  client.cache.updateQuery<any>({ query }, (data) => ({
    friendList: [
      { ...data.friendList[0], name: "Luke (updated)" },
      ...data.friendList.slice(1),
    ],
  }));

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke (updated)" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});
