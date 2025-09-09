import type {
  FormattedExecutionResult,
  FormattedInitialIncrementalExecutionResult,
  FormattedSubsequentIncrementalExecutionResult,
} from "graphql-17-alpha9";
import {
  experimentalExecuteIncrementally,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from "graphql-17-alpha9";
import { from } from "rxjs";

import type { DocumentNode } from "@apollo/client";
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
  markAsStreaming,
  mockDeferStreamGraphQL17Alpha9,
  ObservableStream,
} from "@apollo/client/testing/internal";

const friendType = new GraphQLObjectType({
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    nonNullName: { type: new GraphQLNonNull(GraphQLString) },
  },
  name: "Friend",
});

const friends = [
  { name: "Luke", id: 1 },
  { name: "Han", id: 2 },
  { name: "Leia", id: 3 },
];

const query = new GraphQLObjectType({
  fields: {
    scalarList: {
      type: new GraphQLList(GraphQLString),
    },
    scalarListList: {
      type: new GraphQLList(new GraphQLList(GraphQLString)),
    },
    friendList: {
      type: new GraphQLList(friendType),
    },
    nonNullFriendList: {
      type: new GraphQLList(new GraphQLNonNull(friendType)),
    },
    nestedObject: {
      type: new GraphQLObjectType({
        name: "NestedObject",
        fields: {
          scalarField: {
            type: GraphQLString,
          },
          nonNullScalarField: {
            type: new GraphQLNonNull(GraphQLString),
          },
          nestedFriendList: { type: new GraphQLList(friendType) },
          deeperNestedObject: {
            type: new GraphQLObjectType({
              name: "DeeperNestedObject",
              fields: {
                nonNullScalarField: {
                  type: new GraphQLNonNull(GraphQLString),
                },
                deeperNestedFriendList: { type: new GraphQLList(friendType) },
              },
            }),
          },
        },
      }),
    },
  },
  name: "Query",
});

const schema = new GraphQLSchema({ query });

async function* run(
  document: DocumentNode,
  rootValue: unknown = {},
  enableEarlyExecution = false
): AsyncGenerator<
  | FormattedInitialIncrementalExecutionResult
  | FormattedSubsequentIncrementalExecutionResult
  | FormattedExecutionResult,
  void
> {
  const result = await experimentalExecuteIncrementally({
    schema,
    document,
    rootValue,
    enableEarlyExecution,
  });

  if ("initialResult" in result) {
    yield JSON.parse(JSON.stringify(result.initialResult));

    for await (const patch of result.subsequentResults) {
      yield JSON.parse(JSON.stringify(patch));
    }
  } else {
    yield JSON.parse(JSON.stringify(result));
  }
}

function createLink(rootValue?: Record<string, unknown>) {
  return new ApolloLink((operation) => {
    return from(run(operation.query, rootValue));
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
    loading: true,
    data: markAsStreaming({
      scalarList: ["apple"],
    }),
    dataState: "streaming",
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
    loading: true,
    data: markAsStreaming({
      scalarListList: [["apple", "apple", "apple"]],
    }),
    dataState: "streaming",
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

  await expect(observableStream).toEmitTypedValue({
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

  await expect(observableStream).not.toEmitAnything();
});
