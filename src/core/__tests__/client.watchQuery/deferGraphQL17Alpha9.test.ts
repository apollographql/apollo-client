import { gql } from "graphql-tag";

import type { ObservableQuery } from "@apollo/client";
import { ApolloClient, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { GraphQL17Alpha9Handler } from "@apollo/client/incremental";
import { ApolloLink } from "@apollo/client/link";
import {
  markAsStreaming,
  mockDeferStreamGraphQL17Alpha9,
  ObservableStream,
} from "@apollo/client/testing/internal";

test("deduplicates queries as long as a query still has deferred chunks", async () => {
  const query = gql`
    query LazyLoadLuke {
      people(id: 1) {
        id
        name
        friends {
          id
          ... @defer {
            name
          }
        }
      }
    }
  `;

  const outgoingRequestSpy = jest.fn(((operation, forward) =>
    forward(operation)) satisfies ApolloLink.RequestHandler);
  const defer = mockDeferStreamGraphQL17Alpha9();
  const client = new ApolloClient({
    cache: new InMemoryCache({}),
    link: new ApolloLink(outgoingRequestSpy).concat(defer.httpLink),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query1 = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );
  const query2 = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );
  expect(outgoingRequestSpy).toHaveBeenCalledTimes(1);

  const initialData = {
    people: {
      __typename: "Person",
      id: 1,
      name: "Luke",
      friends: [
        {
          __typename: "Person",
          id: 5,
        } as { __typename: "Person"; id: number; name?: string },
        {
          __typename: "Person",
          id: 8,
        } as { __typename: "Person"; id: number; name?: string },
      ],
    },
  };
  const initialResult: ObservableQuery.Result<typeof initialData> = {
    data: initialData,
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  };

  defer.enqueueInitialChunk({
    data: initialData,
    pending: [
      { id: "0", path: ["people", "friends", 0] },
      { id: "1", path: ["people", "friends", 1] },
    ],
    hasNext: true,
  });

  await expect(query1).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });
  await expect(query2).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(query1).toEmitTypedValue(initialResult);
  await expect(query2).toEmitTypedValue(initialResult);

  const query3 = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );
  await expect(query3).toEmitTypedValue(initialResult);
  expect(outgoingRequestSpy).toHaveBeenCalledTimes(1);

  const firstChunk: GraphQL17Alpha9Handler.SubsequentResult<
    Record<string, unknown>
  > = {
    incremental: [
      {
        data: {
          name: "Leia",
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: true,
  };
  const resultAfterFirstChunk = structuredClone(
    initialResult
  ) as ObservableQuery.Result<any>;
  resultAfterFirstChunk.data.people.friends[0].name = "Leia";

  defer.enqueueSubsequentChunk(firstChunk);

  await expect(query1).toEmitTypedValue(resultAfterFirstChunk);
  await expect(query2).toEmitTypedValue(resultAfterFirstChunk);
  await expect(query3).toEmitTypedValue(resultAfterFirstChunk);

  const query4 = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );
  await expect(query4).toEmitTypedValue(resultAfterFirstChunk);
  expect(outgoingRequestSpy).toHaveBeenCalledTimes(1);

  const secondChunk: GraphQL17Alpha9Handler.SubsequentResult<
    Record<string, unknown>
  > = {
    incremental: [
      {
        data: {
          name: "Han Solo",
        },
        id: "1",
      },
    ],
    completed: [{ id: "1" }],
    hasNext: false,
  };
  const resultAfterSecondChunk = {
    ...structuredClone(resultAfterFirstChunk),
    loading: false,
    networkStatus: NetworkStatus.ready,
    dataState: "complete",
    partial: false,
  } as ObservableQuery.Result<any>;
  resultAfterSecondChunk.data.people.friends[1].name = "Han Solo";

  defer.enqueueSubsequentChunk(secondChunk);

  await expect(query1).toEmitTypedValue(resultAfterSecondChunk);
  await expect(query2).toEmitTypedValue(resultAfterSecondChunk);
  await expect(query3).toEmitTypedValue(resultAfterSecondChunk);
  await expect(query4).toEmitTypedValue(resultAfterSecondChunk);

  // TODO: Re-enable once below condition can be met
  /* const query5 = */ new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );
  // TODO: Re-enable once notifyOnNetworkStatusChange controls whether we
  // get the loading state. This test fails with the switch to RxJS for now
  // since the initial value is emitted synchronously unlike zen-observable
  // where the emitted result wasn't emitted until after this assertion.
  // expect(query5).not.toEmitAnything();
  expect(outgoingRequestSpy).toHaveBeenCalledTimes(2);
});

it.each([["cache-first"], ["no-cache"]] as const)(
  "correctly merges deleted rows when receiving a deferred payload",
  async (fetchPolicy) => {
    const query = gql`
      query Characters {
        characters {
          id
          uppercase
          ... @defer {
            lowercase
          }
        }
      }
    `;

    const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
      mockDeferStreamGraphQL17Alpha9();
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: httpLink,
      incrementalHandler: new GraphQL17Alpha9Handler(),
    });

    const observable = client.watchQuery({ query, fetchPolicy });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    enqueueInitialChunk({
      data: {
        characters: [
          { __typename: "Character", id: 1, uppercase: "A" },
          { __typename: "Character", id: 2, uppercase: "B" },
          { __typename: "Character", id: 3, uppercase: "C" },
        ],
      },
      pending: [
        { id: "0", path: ["characters", 0] },
        { id: "1", path: ["characters", 1] },
        { id: "2", path: ["characters", 2] },
      ],
      hasNext: true,
    });

    await expect(stream).toEmitTypedValue({
      data: markAsStreaming({
        characters: [
          { __typename: "Character", id: 1, uppercase: "A" },
          { __typename: "Character", id: 2, uppercase: "B" },
          { __typename: "Character", id: 3, uppercase: "C" },
        ],
      }),
      dataState: "streaming",
      loading: true,
      networkStatus: NetworkStatus.streaming,
      partial: true,
    });

    enqueueSubsequentChunk({
      incremental: [{ data: { lowercase: "a" }, id: "0" }],
      completed: [{ id: "0" }],
      hasNext: true,
    });

    await expect(stream).toEmitTypedValue({
      data: markAsStreaming({
        characters: [
          { __typename: "Character", id: 1, uppercase: "A", lowercase: "a" },
          { __typename: "Character", id: 2, uppercase: "B" },
          { __typename: "Character", id: 3, uppercase: "C" },
        ],
      }),
      dataState: "streaming",
      loading: true,
      networkStatus: NetworkStatus.streaming,
      partial: true,
    });

    enqueueSubsequentChunk({
      incremental: [
        { data: { lowercase: "b" }, id: "1" },
        { data: { lowercase: "c" }, id: "2" },
      ],
      completed: [{ id: "1" }, { id: "2" }],
      hasNext: false,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        characters: [
          { __typename: "Character", id: 1, uppercase: "A", lowercase: "a" },
          { __typename: "Character", id: 2, uppercase: "B", lowercase: "b" },
          { __typename: "Character", id: 3, uppercase: "C", lowercase: "c" },
        ],
      },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    void observable.refetch();

    await expect(stream).toEmitTypedValue({
      data: {
        characters: [
          { __typename: "Character", id: 1, uppercase: "A", lowercase: "a" },
          { __typename: "Character", id: 2, uppercase: "B", lowercase: "b" },
          { __typename: "Character", id: 3, uppercase: "C", lowercase: "c" },
        ],
      },
      dataState: "complete",
      loading: true,
      networkStatus: NetworkStatus.refetch,
      partial: false,
    });

    // on refetch, the list is shorter
    enqueueInitialChunk({
      data: {
        characters: [
          { __typename: "Character", id: 1, uppercase: "A" },
          { __typename: "Character", id: 2, uppercase: "B" },
        ],
      },
      pending: [
        { id: "0", path: ["characters", 0] },
        { id: "1", path: ["characters", 1] },
      ],
      hasNext: true,
    });

    await expect(stream).toEmitTypedValue({
      data: markAsStreaming({
        characters:
          // no-cache fetch policy doesn't merge with existing cache data, so
          // the lowercase field is not available in the refetch
          fetchPolicy === "no-cache" ?
            [
              { __typename: "Character", id: 1, uppercase: "A" },
              { __typename: "Character", id: 2, uppercase: "B" },
            ]
          : [
              {
                __typename: "Character",
                id: 1,
                uppercase: "A",
                lowercase: "a",
              },
              {
                __typename: "Character",
                id: 2,
                uppercase: "B",
                lowercase: "b",
              },
            ],
      }),
      dataState: "streaming",
      loading: true,
      networkStatus: NetworkStatus.streaming,
      partial: true,
    });

    enqueueSubsequentChunk({
      incremental: [
        { data: { lowercase: "a" }, id: "0" },
        { data: { lowercase: "b" }, id: "1" },
      ],
      completed: [{ id: "0" }, { id: "1" }],
      hasNext: false,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        characters: [
          { __typename: "Character", id: 1, uppercase: "A", lowercase: "a" },
          { __typename: "Character", id: 2, uppercase: "B", lowercase: "b" },
        ],
      },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await expect(stream).not.toEmitAnything();
  }
);
