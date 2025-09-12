import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { from } from "rxjs";

import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  gql,
  InMemoryCache,
  NetworkStatus,
} from "@apollo/client";
import { GraphQL17Alpha9Handler } from "@apollo/client/incremental";
import { useQuery } from "@apollo/client/react";
import {
  asyncIterableSubject,
  createClientWrapper,
  executeSchemaGraphQL17Alpha9,
  friendListSchemaGraphQL17Alpha9,
  markAsStreaming,
  spyOnConsole,
} from "@apollo/client/testing/internal";

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

test("should handle streamed queries", async () => {
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
    link: createLink({ friendList: () => stream }),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  subject.next(friends[0]);

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: undefined,
    variables: {},
  });

  subject.next(friends[1]);

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: {
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    },
    variables: {},
  });

  subject.next(friends[2]);
  subject.complete();

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
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
    previousData: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    },
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
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
    previousData: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    },
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});

test("should handle streamed queries with fetch policy no-cache", async () => {
  const { subject, stream } = asyncIterableSubject<Friend>();
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

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { fetchPolicy: "no-cache" }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  subject.next(friends[0]);

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: undefined,
    variables: {},
  });

  subject.next(friends[1]);

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: {
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    },
    variables: {},
  });

  subject.next(friends[2]);
  subject.complete();

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
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
    previousData: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    },
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
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
    previousData: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    },
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});

test("should handle streamed queries with errors returned on the incremental batched result", async () => {
  const { stream, subject } = asyncIterableSubject<Friend | Error>();
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

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  subject.next(friends[0]);

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: undefined,
    variables: {},
  });

  subject.next(new Error("Could not load friend"));

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    },
    dataState: "complete",
    error: new CombinedGraphQLErrors({
      data: {
        friendList: [{ __typename: "Friend", id: "1", name: "Luke" }, null],
      },
      errors: [
        {
          message: "Could not load friend",
          path: ["friendList", 1],
        },
      ],
    }),
    loading: false,
    networkStatus: NetworkStatus.error,
    previousData: undefined,
    variables: {},
  });

  // Emit these to show that errorPolicy of none cuts off future updates
  subject.next(friends[2]);
  subject.complete();

  await expect(takeSnapshot).not.toRerender();
});

test('should handle streamed queries with errors returned on the incremental batched result and errorPolicy "all"', async () => {
  const { stream, subject } = asyncIterableSubject<Friend | Error>();
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

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { errorPolicy: "all" }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  subject.next(friends[0]);

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: undefined,
    variables: {},
  });

  subject.next(new Error("Could not load friend"));

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }, null],
    }),
    dataState: "streaming",
    error: new CombinedGraphQLErrors({
      data: {
        friendList: [{ __typename: "Friend", id: "1", name: "Luke" }, null],
      },
      errors: [
        {
          message: "Could not load friend",
          path: ["friendList", 1],
        },
      ],
    }),
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: {
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    },
    variables: {},
  });

  subject.next(friends[2]);
  subject.complete();

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        null,
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    }),
    dataState: "streaming",
    error: new CombinedGraphQLErrors({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          null,
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      },
      errors: [
        {
          message: "Could not load friend",
          path: ["friendList", 1],
        },
      ],
    }),
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: {
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }, null],
    },
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        null,
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    },
    dataState: "complete",
    error: new CombinedGraphQLErrors({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          null,
          { __typename: "Friend", id: "3", name: "Leia" },
        ],
      },
      errors: [
        {
          message: "Could not load friend",
          path: ["friendList", 1],
        },
      ],
    }),
    loading: false,
    networkStatus: NetworkStatus.error,
    previousData: {
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }, null],
    },
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});

test('returns eventually consistent data from streamed queries with data in the cache while using a "cache-and-network" fetch policy', async () => {
  const { subject, stream } = asyncIterableSubject<Friend>();
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
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { fetchPolicy: "cache-and-network" }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
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
    previousData: undefined,
    variables: {},
  });

  subject.next(friends[0]);

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
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
    previousData: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Cached Luke" },
        { __typename: "Friend", id: "2", name: "Cached Han" },
        { __typename: "Friend", id: "3", name: "Cached Leia" },
      ],
    },
    variables: {},
  });

  subject.next(friends[1]);

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
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
    previousData: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Cached Han" },
        { __typename: "Friend", id: "3", name: "Cached Leia" },
      ],
    },
    variables: {},
  });

  subject.next(friends[2]);
  subject.complete();

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
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
    previousData: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Cached Leia" },
      ],
    },
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
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
    previousData: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Cached Leia" },
      ],
    },
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});

// TODO: Determine how we handle partial data with streamed responses. While this
// works as expected and renders correctly, this also emits missing field
// warnings in the console when writing the result to the cache since array items
// with partial cache data are still included for items that haven't streamed in
// yet.
test('returns eventually consistent data from streamed queries with partial data in the cache and using a "cache-first" fetch policy with `returnPartialData`', async () => {
  using _TODO_REMOVE_ME_AFTER_DECIDING_COMMENT = spyOnConsole("error");
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

  // We know we are writing partial data to the cache so suppress the console
  // warning.
  {
    // using _consoleSpy = spyOnConsole("error");
    client.writeQuery({
      query,
      data: {
        friendList: [
          { __typename: "Friend", id: "1" },
          { __typename: "Friend", id: "2" },
          { __typename: "Friend", id: "3" },
        ],
      },
    });
  }

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useQuery(query, {
        fetchPolicy: "cache-first",
        returnPartialData: true,
      }),
    {
      wrapper: createClientWrapper(client),
    }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      friendList: [
        { __typename: "Friend", id: "1" },
        { __typename: "Friend", id: "2" },
        { __typename: "Friend", id: "3" },
      ],
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  subject.next(friends[0]);

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2" },
        { __typename: "Friend", id: "3" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: {
      friendList: [
        { __typename: "Friend", id: "1" },
        { __typename: "Friend", id: "2" },
        { __typename: "Friend", id: "3" },
      ],
    },
    variables: {},
  });

  subject.next(friends[1]);

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2" },
        { __typename: "Friend", id: "3" },
      ],
    },
    variables: {},
  });

  subject.next(friends[2]);
  subject.complete();

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
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
    previousData: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3" },
      ],
    },
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
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
    previousData: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3" },
      ],
    },
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});
