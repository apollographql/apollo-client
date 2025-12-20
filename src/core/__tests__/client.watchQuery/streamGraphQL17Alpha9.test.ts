import { from } from "rxjs";

import type { FieldMergeFunction } from "@apollo/client";
import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  gql,
  InMemoryCache,
  NetworkStatus,
} from "@apollo/client";
import { GraphQL17Alpha9Handler } from "@apollo/client/incremental";
import {
  asyncIterableSubject,
  executeSchemaGraphQL17Alpha9,
  friendListSchemaGraphQL17Alpha9,
  markAsStreaming,
  mockDeferStreamGraphQL17Alpha9,
  ObservableStream,
  promiseWithResolvers,
  wait,
} from "@apollo/client/testing/internal";
import { hasDirectives } from "@apollo/client/utilities/internal";

const friends = [
  { name: "Luke", id: 1 },
  { name: "Han", id: 2 },
  { name: "Leia", id: 3 },
];

type Friend = (typeof friends)[number];

function createLink(rootValue?: Record<string, unknown>) {
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

test("handles streamed scalar lists", async () => {
  const client = new ApolloClient({
    link: createLink({ scalarList: ["apple", "banana", "orange"] }),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query ScalarListQuery {
      scalarList @stream(initialCount: 1)
    }
  `;

  const observableStream = new ObservableStream(client.watchQuery({ query }));

  await expect(observableStream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      scalarList: ["apple"],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: {
      scalarList: ["apple", "banana", "orange"],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
});

test("handles streamed multi-dimensional lists", async () => {
  const client = new ApolloClient({
    link: createLink({
      scalarListList: [
        ["apple", "apple", "apple"],
        ["banana", "banana", "banana"],
        ["coconut", "coconut", "coconut"],
      ],
    }),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query ScalarListQuery {
      scalarListList @stream(initialCount: 1)
    }
  `;

  const observableStream = new ObservableStream(client.watchQuery({ query }));

  await expect(observableStream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      scalarListList: [["apple", "apple", "apple"]],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: {
      scalarListList: [
        ["apple", "apple", "apple"],
        ["banana", "banana", "banana"],
        ["coconut", "coconut", "coconut"],
      ],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
});

test("merges cache updates that happen concurrently", async () => {
  const stream = mockDeferStreamGraphQL17Alpha9();
  const client = new ApolloClient({
    link: stream.httpLink,
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query FriendListQuery {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const observableStream = new ObservableStream(client.watchQuery({ query }));

  await expect(observableStream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  stream.enqueueInitialChunk({
    data: {
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    },
    pending: [{ id: "0", path: ["friendList"] }],
    hasNext: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  client.cache.writeFragment({
    id: "Friend:1",
    fragment: gql`
      fragment FriendName on Friend {
        name
      }
    `,
    data: {
      name: "Jedi",
    },
  });

  stream.enqueueSubsequentChunk({
    incremental: [
      {
        items: [
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3", name: "Leia" },
        ] as any,
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(observableStream).toEmitTypedValue({
    data: {
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Jedi", // updated from cache
        },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
});

test("handles errors from items before initialCount is reached", async () => {
  const client = new ApolloClient({
    link: createLink({
      friendList: () =>
        friends.map((friend, i) => {
          if (i === 1) {
            return Promise.reject(new Error("bad"));
          }

          return Promise.resolve(friend);
        }),
    }),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query FriendListQuery {
      friendList @stream(initialCount: 2) {
        id
        name
      }
    }
  `;

  const observableStream = new ObservableStream(
    client.watchQuery({ query, errorPolicy: "all" })
  );

  await expect(observableStream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }, null],
    }),
    error: new CombinedGraphQLErrors({
      data: {
        friendList: [{ __typename: "Friend", id: "1", name: "Luke" }, null],
      },
      errors: [{ message: "bad", path: ["friendList", 1] }],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        null,
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    }),
    error: new CombinedGraphQLErrors({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          null,
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      },
      errors: [{ message: "bad", path: ["friendList", 1] }],
    }),
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.error,
    partial: false,
  });

  await expect(observableStream).not.toEmitAnything();
});

test("handles errors from items after initialCount is reached", async () => {
  const client = new ApolloClient({
    link: createLink({
      friendList: () =>
        friends.map((friend, i) => {
          if (i === 1) {
            return Promise.reject(new Error("bad"));
          }

          return Promise.resolve(friend);
        }),
    }),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query FriendListQuery {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const observableStream = new ObservableStream(
    client.watchQuery({ query, errorPolicy: "all" })
  );

  await expect(observableStream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }, null],
    }),
    error: new CombinedGraphQLErrors({
      data: {
        friendList: [{ __typename: "Friend", id: "1", name: "Luke" }, null],
      },
      errors: [{ message: "bad", path: ["friendList", 1] }],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        null,
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    }),
    error: new CombinedGraphQLErrors({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          null,
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      },
      errors: [{ message: "bad", path: ["friendList", 1] }],
    }),
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.error,
    partial: false,
  });

  await expect(observableStream).not.toEmitAnything();
});

test("handles final chunk without incremental value", async () => {
  const client = new ApolloClient({
    link: createLink({
      async *friendList() {
        yield await Promise.resolve(friends[0]);
        yield await Promise.resolve(friends[1]);
        yield await Promise.resolve(friends[2]);
      },
    }),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query FriendListQuery {
      friendList @stream {
        id
        name
      }
    }
  `;

  const observableStream = new ObservableStream(client.watchQuery({ query }));

  await expect(observableStream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitSimilarValue({
    expected: (previous) => ({
      ...previous,
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    }),
  });

  await expect(observableStream).not.toEmitAnything();
});

test("handles errors thrown before initialCount is reached", async () => {
  const client = new ApolloClient({
    link: createLink({
      async *friendList() {
        yield await Promise.resolve(friends[0]);
        throw new Error("bad");
      },
    }),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query FriendListQuery {
      friendList @stream(initialCount: 2) {
        id
        name
      }
    }
  `;

  const observableStream = new ObservableStream(
    client.watchQuery({ query, errorPolicy: "all" })
  );

  await expect(observableStream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: {
      friendList: null,
    },
    error: new CombinedGraphQLErrors({
      data: { friendList: null },
      errors: [
        {
          message: "bad",
          path: ["friendList"],
        },
      ],
    }),
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.error,
    partial: false,
  });

  await expect(observableStream).not.toEmitAnything();
});

test("handles errors thrown after initialCount is reached", async () => {
  const client = new ApolloClient({
    link: createLink({
      async *friendList() {
        yield await Promise.resolve(friends[0]);
        throw new Error("bad");
      },
    }),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query FriendListQuery {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const observableStream = new ObservableStream(
    client.watchQuery({ query, errorPolicy: "all" })
  );

  await expect(observableStream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: {
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    },
    error: new CombinedGraphQLErrors({
      data: { friendList: [{ __typename: "Friend", id: "1", name: "Luke" }] },
      errors: [
        {
          message: "bad",
          path: ["friendList"],
        },
      ],
    }),
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.error,
    partial: false,
  });

  await expect(observableStream).not.toEmitAnything();
});

it("handles errors thrown due to null returned in non-null list items after initialCount is reached", async () => {
  const client = new ApolloClient({
    link: createLink({
      nonNullFriendList: () => [friends[0], null, friends[1]],
    }),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query {
      nonNullFriendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const observableStream = new ObservableStream(
    client.watchQuery({ query, errorPolicy: "all" })
  );

  await expect(observableStream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      nonNullFriendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: {
      nonNullFriendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    },
    error: new CombinedGraphQLErrors({
      data: {
        nonNullFriendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
      },
      errors: [
        {
          message:
            "Cannot return null for non-nullable field Query.nonNullFriendList.",
          path: ["nonNullFriendList", 1],
        },
      ],
    }),
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.error,
    partial: false,
  });

  await expect(observableStream).not.toEmitAnything();
});

it("handles stream when in parent deferred fragment", async () => {
  const { promise: slowFieldPromise, resolve: resolveSlowField } =
    promiseWithResolvers();

  const client = new ApolloClient({
    link: createLink({
      nestedObject: {
        scalarField: () => slowFieldPromise,
        async *nestedFriendList() {
          yield await Promise.resolve(friends[0]);
          yield await Promise.resolve(friends[1]);
        },
      },
    }),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query {
      nestedObject {
        ...DeferFragment @defer
      }
    }
    fragment DeferFragment on NestedObject {
      scalarField
      nestedFriendList @stream(initialCount: 0) {
        id
        name
      }
    }
  `;

  const observableStream = new ObservableStream(client.watchQuery({ query }));

  await expect(observableStream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      nestedObject: {
        __typename: "NestedObject",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  resolveSlowField("slow");

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      nestedObject: {
        __typename: "NestedObject",
        scalarField: "slow",
        nestedFriendList: [],
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      nestedObject: {
        __typename: "NestedObject",
        scalarField: "slow",
        nestedFriendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      nestedObject: {
        __typename: "NestedObject",
        scalarField: "slow",
        nestedFriendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
        ],
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitSimilarValue({
    expected: (previous) => ({
      ...previous,
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    }),
  });

  await expect(observableStream).not.toEmitAnything();
});

test("handles @defer inside @stream", async () => {
  const { promise: slowFieldPromise, resolve: resolveSlowField } =
    promiseWithResolvers();
  const {
    promise: iterableCompletionPromise,
    resolve: resolveIterableCompletion,
  } = promiseWithResolvers<void>();

  const client = new ApolloClient({
    link: createLink({
      async *friendList() {
        yield await Promise.resolve(friends[0]);
        yield await Promise.resolve({
          id: friends[1].id,
          name: () => slowFieldPromise,
        });
        await iterableCompletionPromise;
      },
    }),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query {
      friendList @stream {
        ...NameFragment @defer
        id
      }
    }
    fragment NameFragment on Friend {
      name
    }
  `;

  const observableStream = new ObservableStream(client.watchQuery({ query }));

  await expect(observableStream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  resolveIterableCompletion();

  await expect(observableStream).toEmitSimilarValue({
    expected: (previous) => ({
      ...previous,
      data: markAsStreaming({
        friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
      }),
      dataState: "streaming",
    }),
  });

  resolveSlowField("Han");

  await expect(observableStream).toEmitSimilarValue({
    expected: (previous) => ({
      ...previous,
      data: markAsStreaming({
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2" },
        ],
      }),
      dataState: "streaming",
    }),
  });

  await expect(observableStream).toEmitTypedValue({
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(observableStream).not.toEmitAnything();
});

test("can use custom merge function to combine cached and streamed lists", async () => {
  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          friendList: {
            merge: (existing = [], incoming, { field }) => {
              if (field && hasDirectives(["stream"], field)) {
                const merged: any[] = [];

                for (
                  let i = 0;
                  i < Math.max(existing.length, incoming.length);
                  i++
                ) {
                  merged[i] =
                    incoming[i] === undefined ? existing[i] : incoming[i];
                }

                return merged;
              }

              return incoming;
            },
          },
        },
      },
    },
  });

  const client = new ApolloClient({
    link: createLink({
      friendList: () => friends.map((friend) => Promise.resolve(friend)),
    }),
    cache,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

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

  const stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "cache-and-network" })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Cached Luke" },
        { __typename: "Friend", id: "2", name: "Cached Han" },
        { __typename: "Friend", id: "3", name: "Cached Leia" },
      ],
    },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Cached Han" },
        { __typename: "Friend", id: "3", name: "Cached Leia" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Cached Leia" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("provides streamFieldDetails to merge functions", async () => {
  const merge = createMockStreamMergeFn();

  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          friendList: {
            merge,
          },
        },
      },
    },
  });

  const client = new ApolloClient({
    link: createLink({
      friendList: () => friends.map((friend) => Promise.resolve(friend)),
    }),
    cache,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    }),
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();

  expect(merge).toHaveBeenCalledTimes(3);
  expect(merge).toHaveBeenNthCalledWith(
    1,
    undefined,
    [{ __ref: "Friend:1" }],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: true, isLastChunk: false },
    })
  );
  expect(merge).toHaveBeenNthCalledWith(
    2,
    [{ __ref: "Friend:1" }],
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: false },
    })
  );
  expect(merge).toHaveBeenNthCalledWith(
    3,
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }],
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }, { __ref: "Friend:3" }],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: true },
    })
  );
});

test("returns correct streamFieldDetails when final chunk is only hasNext: false", async () => {
  const merge = createMockStreamMergeFn();
  const { stream: friendStream, subject } = asyncIterableSubject<Friend>();

  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          friendList: {
            merge,
          },
        },
      },
    },
  });

  const client = new ApolloClient({
    link: createLink({
      friendList: async () => friendStream,
    }),
    cache,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  subject.next(friends[0]);

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  subject.next(friends[1]);

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  subject.next(friends[2]);

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  subject.complete();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    }),
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();

  expect(merge).toHaveBeenCalledTimes(4);
  expect(merge).toHaveBeenNthCalledWith(
    1,
    undefined,
    [{ __ref: "Friend:1" }],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: true, isLastChunk: false },
    })
  );
  expect(merge).toHaveBeenNthCalledWith(
    2,
    [{ __ref: "Friend:1" }],
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: false },
    })
  );
  expect(merge).toHaveBeenNthCalledWith(
    3,
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }],
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }, { __ref: "Friend:3" }],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: false },
    })
  );
  expect(merge).toHaveBeenNthCalledWith(
    4,
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }, { __ref: "Friend:3" }],
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }, { __ref: "Friend:3" }],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: true },
    })
  );
});

test("provides streamFieldDetails to merge functions in nested stream fields", async () => {
  const merge = createMockStreamMergeFn();

  const cache = new InMemoryCache({
    typePolicies: {
      NestedObject: {
        fields: {
          nestedFriendList: {
            merge,
          },
        },
      },
    },
  });

  const client = new ApolloClient({
    link: createLink({
      nestedObject: {
        nestedFriendList: () =>
          friends.map((friend) => Promise.resolve(friend)),
      },
    }),
    cache,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query {
      nestedObject {
        nestedFriendList @stream(initialCount: 1) {
          id
          name
        }
      }
    }
  `;

  const stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      nestedObject: {
        __typename: "NestedObject",
        nestedFriendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      nestedObject: {
        __typename: "NestedObject",
        nestedFriendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
        ],
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      nestedObject: {
        __typename: "NestedObject",
        nestedFriendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      },
    }),
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  expect(merge).toHaveBeenCalledTimes(3);
  expect(merge).toHaveBeenNthCalledWith(
    1,
    undefined,
    [{ __ref: "Friend:1" }],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: true, isLastChunk: false },
    })
  );
  expect(merge).toHaveBeenNthCalledWith(
    2,
    [{ __ref: "Friend:1" }],
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: false },
    })
  );
  expect(merge).toHaveBeenNthCalledWith(
    3,
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }],
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }, { __ref: "Friend:3" }],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: true },
    })
  );
});

test("provides streamFieldDetails to merge functions in sibling stream fields", async () => {
  const friendListMerge = createMockStreamMergeFn();
  const nonNullFriendListMerge = createMockStreamMergeFn();

  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          friendList: {
            merge: friendListMerge,
          },
          nonNullFriendList: {
            merge: nonNullFriendListMerge,
          },
        },
      },
    },
  });

  const client = new ApolloClient({
    link: createLink({
      friendList: () => friends.map((friend) => Promise.resolve(friend)),
      nonNullFriendList: () => friends.map((friend) => Promise.resolve(friend)),
    }),
    cache,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
      nonNullFriendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
      nonNullFriendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
      nonNullFriendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
      nonNullFriendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
      nonNullFriendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    }),
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();

  expect(friendListMerge).toHaveBeenCalledTimes(4);
  expect(friendListMerge).toHaveBeenNthCalledWith(
    1,
    undefined,
    [{ __ref: "Friend:1" }],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: true, isLastChunk: false },
    })
  );
  expect(friendListMerge).toHaveBeenNthCalledWith(
    2,
    [{ __ref: "Friend:1" }],
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: false },
    })
  );
  expect(friendListMerge).toHaveBeenNthCalledWith(
    3,
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }],
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }, { __ref: "Friend:3" }],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: true },
    })
  );
  expect(friendListMerge).toHaveBeenNthCalledWith(
    4,
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }, { __ref: "Friend:3" }],
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }, { __ref: "Friend:3" }],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: true },
    })
  );

  expect(nonNullFriendListMerge).toHaveBeenCalledTimes(4);
  expect(nonNullFriendListMerge).toHaveBeenNthCalledWith(
    1,
    undefined,
    [{ __ref: "Friend:1" }],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: true, isLastChunk: false },
    })
  );
  expect(nonNullFriendListMerge).toHaveBeenNthCalledWith(
    2,
    [{ __ref: "Friend:1" }],
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: false },
    })
  );
  expect(nonNullFriendListMerge).toHaveBeenNthCalledWith(
    3,
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }],
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: false },
    })
  );
  expect(nonNullFriendListMerge).toHaveBeenNthCalledWith(
    4,
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }],
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }, { __ref: "Friend:3" }],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: true },
    })
  );
});

test("provides undefined streamFieldDetails to non-stream merge functions", async () => {
  const nestedObjectMerge = jest.fn((_, incoming) => incoming);
  const friendListMerge = jest.fn((_, incoming) => incoming);

  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          friendList: {
            merge: friendListMerge,
          },
          nestedObject: {
            merge: nestedObjectMerge,
          },
        },
      },
    },
  });

  const client = new ApolloClient({
    link: createLink({
      friendList: () => friends,
      nestedObject: () => ({}),
    }),
    cache,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query {
      nestedObject {
        __typename
      }
      friendList {
        id
        name
      }
    }
  `;

  const stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
      nestedObject: {
        __typename: "NestedObject",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();

  expect(friendListMerge).toHaveBeenCalledTimes(1);
  expect(friendListMerge).toHaveBeenCalledWith(
    undefined,
    [{ __ref: "Friend:1" }, { __ref: "Friend:2" }, { __ref: "Friend:3" }],
    expect.not.objectContaining({
      streamFieldDetails: expect.anything(),
    })
  );
  expect(nestedObjectMerge).toHaveBeenCalledTimes(1);
  expect(nestedObjectMerge).toHaveBeenCalledWith(
    undefined,
    { __typename: "NestedObject" },
    expect.not.objectContaining({
      streamFieldDetails: expect.anything(),
    })
  );
});

test("sets correct streamFieldDetails when field name is same in different locations", async () => {
  const scalarListMerge = createMockStreamMergeFn();
  const nestedScalarListMerge = createMockStreamMergeFn();

  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          scalarList: {
            merge: scalarListMerge,
          },
        },
      },
      NestedObject: {
        fields: {
          scalarList: {
            merge: nestedScalarListMerge,
          },
        },
      },
    },
  });

  const list = ["one", "two", "three"];

  const client = new ApolloClient({
    link: createLink({
      scalarList: () => list.map((str) => Promise.resolve(str)),
      nestedObject: () => ({
        scalarList: list.map((str) => Promise.resolve(str)),
      }),
    }),
    cache,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query {
      scalarList @stream(initialCount: 1)
      nestedObject {
        scalarList @stream(initialCount: 1)
      }
    }
  `;

  const stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      scalarList: ["one"],
      nestedObject: { __typename: "NestedObject", scalarList: ["one"] },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      scalarList: ["one", "two"],
      nestedObject: { __typename: "NestedObject", scalarList: ["one", "two"] },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      scalarList: ["one", "two", "three"],
      nestedObject: { __typename: "NestedObject", scalarList: ["one", "two"] },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      scalarList: ["one", "two", "three"],
      nestedObject: {
        __typename: "NestedObject",
        scalarList: ["one", "two", "three"],
      },
    }),
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();

  expect(scalarListMerge).toHaveBeenCalledTimes(4);
  expect(scalarListMerge).toHaveBeenNthCalledWith(
    1,
    undefined,
    ["one"],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: true, isLastChunk: false },
    })
  );
  expect(scalarListMerge).toHaveBeenNthCalledWith(
    2,
    ["one"],
    ["one", "two"],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: false },
    })
  );
  expect(scalarListMerge).toHaveBeenNthCalledWith(
    3,
    ["one", "two"],
    ["one", "two", "three"],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: true },
    })
  );
  expect(scalarListMerge).toHaveBeenNthCalledWith(
    4,
    ["one", "two", "three"],
    ["one", "two", "three"],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: true },
    })
  );

  expect(nestedScalarListMerge).toHaveBeenCalledTimes(4);
  expect(nestedScalarListMerge).toHaveBeenNthCalledWith(
    1,
    undefined,
    ["one"],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: true, isLastChunk: false },
    })
  );
  expect(nestedScalarListMerge).toHaveBeenNthCalledWith(
    2,
    ["one"],
    ["one", "two"],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: false },
    })
  );
  expect(nestedScalarListMerge).toHaveBeenNthCalledWith(
    3,
    ["one", "two"],
    ["one", "two"],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: false },
    })
  );
  expect(nestedScalarListMerge).toHaveBeenNthCalledWith(
    4,
    ["one", "two"],
    ["one", "two", "three"],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: true },
    })
  );
});

test("sets correct streamFieldDetails when stream field is inside another list", async () => {
  const merge = createMockStreamMergeFn();

  const cache = new InMemoryCache({
    typePolicies: {
      Friend: {
        fields: {
          scalarList: {
            merge,
          },
        },
      },
    },
  });

  const scalarList = ["one", "two", "three"];

  const client = new ApolloClient({
    link: createLink({
      friendList: () =>
        friends.slice(0, 2).map((friend, i) => ({
          ...friend,
          scalarList: scalarList.map((str, j) =>
            wait((i + j) * 10).then(() => str)
          ),
        })),
    }),
    cache,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query {
      friendList {
        id
        name
        scalarList @stream(initialCount: 1)
      }
    }
  `;

  const stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke", scalarList: ["one"] },
        { __typename: "Friend", id: "2", name: "Han", scalarList: ["one"] },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          scalarList: ["one", "two"],
        },
        {
          __typename: "Friend",
          id: "2",
          name: "Han",
          scalarList: ["one"],
        },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          scalarList: ["one", "two", "three"],
        },
        {
          __typename: "Friend",
          id: "2",
          name: "Han",
          scalarList: ["one"],
        },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          scalarList: ["one", "two", "three"],
        },
        {
          __typename: "Friend",
          id: "2",
          name: "Han",
          scalarList: ["one", "two"],
        },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          scalarList: ["one", "two", "three"],
        },
        {
          __typename: "Friend",
          id: "2",
          name: "Han",
          scalarList: ["one", "two", "three"],
        },
      ],
    }),
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();

  expect(merge).toHaveBeenCalledTimes(10);
  // friend:1 ["one"]
  expect(merge).toHaveBeenNthCalledWith(
    1,
    undefined,
    ["one"],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: true, isLastChunk: false },
    })
  );
  // friend:2 ["one"]
  expect(merge).toHaveBeenNthCalledWith(
    2,
    undefined,
    ["one"],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: true, isLastChunk: false },
    })
  );
  // friend:1 ["one", "two"]
  expect(merge).toHaveBeenNthCalledWith(
    3,
    ["one"],
    ["one", "two"],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: false },
    })
  );
  // friend:2 ["one"]
  expect(merge).toHaveBeenNthCalledWith(
    4,
    ["one"],
    ["one"],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: true, isLastChunk: false },
    })
  );
  // friend:1 ["one", "two", "three"]
  expect(merge).toHaveBeenNthCalledWith(
    5,
    ["one", "two"],
    ["one", "two", "three"],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: true },
    })
  );
  // friend:2 ["one"]
  expect(merge).toHaveBeenNthCalledWith(
    6,
    ["one"],
    ["one"],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: true, isLastChunk: false },
    })
  );
  // friend:1 ["one", "two", "three"]
  expect(merge).toHaveBeenNthCalledWith(
    7,
    ["one", "two", "three"],
    ["one", "two", "three"],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: true },
    })
  );
  // friend:2 ["one", "two"]
  expect(merge).toHaveBeenNthCalledWith(
    8,
    ["one"],
    ["one", "two"],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: false },
    })
  );
  // friend:1 ["one", "two", "three"]
  expect(merge).toHaveBeenNthCalledWith(
    9,
    ["one", "two", "three"],
    ["one", "two", "three"],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: true },
    })
  );
  // friend:2 ["one", "two", "three"]
  expect(merge).toHaveBeenNthCalledWith(
    10,
    ["one", "two"],
    ["one", "two", "three"],
    expect.objectContaining({
      streamFieldDetails: { isFirstChunk: false, isLastChunk: true },
    })
  );
});

test("truncates array with default merge function on refetch when last chunk is emitted when refetched array is shorter", async () => {
  let { stream: friendStream, subject } = asyncIterableSubject<Friend>();

  const client = new ApolloClient({
    link: createLink({
      friendList: async () => friendStream,
    }),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const observable = client.watchQuery({ query });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  subject.next(friends[0]);

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  subject.next(friends[1]);

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  subject.next(friends[2]);

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  subject.complete();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    }),
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();

  ({ stream: friendStream, subject } = asyncIterableSubject<Friend>());

  const refetchPromise = observable.refetch();

  subject.next({ ...friends[0], name: `${friends[0].name} (refetch)` });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    }),
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke (refetch)" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  subject.next({ ...friends[1], name: `${friends[1].name} (refetch)` });
  subject.complete();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke (refetch)" },
        { __typename: "Friend", id: "2", name: "Han (refetch)" },
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke (refetch)" },
        { __typename: "Friend", id: "2", name: "Han (refetch)" },
      ],
    }),
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
  await expect(refetchPromise).resolves.toStrictEqualTyped({
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke (refetch)" },
        { __typename: "Friend", id: "2", name: "Han (refetch)" },
      ],
    },
  });
});

test("truncates array when fetched array is shorter than cached array with cache-and-network fetch policy", async () => {
  let { stream: friendStream, subject } = asyncIterableSubject<Friend>();

  const client = new ApolloClient({
    link: createLink({
      friendList: async () => friendStream,
    }),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  client.writeQuery({
    query,
    data: {
      friendList: friends.map((friend) => ({
        __typename: "Friend",
        id: String(friend.id),
        name: `Cached ${friend.name}`,
      })),
    },
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "cache-and-network" })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Cached Luke" },
        { __typename: "Friend", id: "2", name: "Cached Han" },
        { __typename: "Friend", id: "3", name: "Cached Leia" },
      ],
    },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: false,
  });

  subject.next(friends[0]);

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Cached Han" },
        { __typename: "Friend", id: "3", name: "Cached Leia" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  subject.next(friends[1]);
  subject.complete();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Cached Leia" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    }),
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

function createMockStreamMergeFn() {
  return jest.fn<
    ReturnType<FieldMergeFunction<any[]>>,
    Parameters<FieldMergeFunction<any[]>>
  >((existing = [], incoming) => {
    const length = Math.max(existing.length, incoming.length);
    const result = [];

    for (let i = 0; i < length; i++) {
      result[i] = incoming[i] === undefined ? existing[i] : incoming[i];
    }

    return result;
  });
}
