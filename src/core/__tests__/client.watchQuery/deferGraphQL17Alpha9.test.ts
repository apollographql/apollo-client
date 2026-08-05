import { gql } from "graphql-tag";
import { from } from "rxjs";

import type { ObservableQuery } from "@apollo/client";
import {
  ApolloClient,
  CombinedGraphQLErrors,
  NetworkStatus,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { GraphQL17Alpha9Handler } from "@apollo/client/incremental";
import { ApolloLink } from "@apollo/client/link";
import {
  executeSchemaGraphQL17Alpha9,
  friendListSchemaGraphQL17Alpha9,
  markAsStreaming,
  mockDeferStreamGraphQL17Alpha9,
  ObservableStream,
  promiseWithResolvers,
  spyOnConsole,
} from "@apollo/client/testing/internal";

function uppercaseRead(existing: unknown) {
  return typeof existing === "string" ? existing.toUpperCase() : existing;
}

function createSchemaLink(rootValue?: Record<string, unknown>) {
  return new ApolloLink((operation) =>
    from(
      executeSchemaGraphQL17Alpha9(
        friendListSchemaGraphQL17Alpha9,
        operation.query,
        rootValue
      )
    )
  );
}

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
  "correctly merges deleted rows when receiving a deferred payload with %s fetch policy",
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
      // The cache data from the initial query fulfills the data requirements so
      // its considered complete
      dataState: fetchPolicy === "no-cache" ? "streaming" : "complete",
      loading: true,
      networkStatus: NetworkStatus.streaming,
      partial: fetchPolicy === "no-cache",
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

test('returns non-deferred cached data with a "cache-first" fetch policy and returnPartialData: false', async () => {
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  // We are intentionally writing partial data to the cache. Suppress console
  // warnings to avoid unnecessary noise in the test.
  {
    using _consoleSpy = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Cached hello",
        },
      },
    });
  }

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          recipient: {
            name: "Alice",
            email: "alice@example.com",
            __typename: "Person",
          },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not return incomplete cached fields inside a deferred named fragment spread with returnPartialData: false", async () => {
  const query = gql`
    query {
      greeting {
        message
        ...GreetingRecipient @defer
      }
    }

    fragment GreetingRecipient on Greeting {
      recipient {
        name
        email
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  {
    using _ = spyOnConsole("error");
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
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: {
            __typename: "Person",
            name: "Alice",
            email: "alice@example.com",
          },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not surface incomplete cached fields from nested fragments inside a `@defer` boundary with returnPartialData: false", async () => {
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          ... on Greeting {
            recipient {
              name
            }
            signature
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  {
    using _ = spyOnConsole("error");
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
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: { __typename: "Person", name: "Alice" },
          signature: "From Apollo",
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
        signature: "From Apollo",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not surface incomplete cached fields from a named fragment spread inside a `@defer` boundary with returnPartialData: false", async () => {
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          ...DeferredGreeting
        }
      }
    }

    fragment DeferredGreeting on Greeting {
      recipient {
        name
      }
      signature
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  {
    using _ = spyOnConsole("error");
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
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: { __typename: "Person", name: "Alice" },
          signature: "From Apollo",
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
        signature: "From Apollo",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not surface incomplete cached defer-only fields under an overlapping parent with returnPartialData: false", async () => {
  const query = gql`
    query {
      greeting {
        message
        recipient {
          name
        }
        ... on Greeting @defer {
          recipient {
            name
            email
            phone
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          recipient: {
            __typename: "Person",
            name: "Cached Alice",
            email: "cached@example.com",
          },
        },
      },
    });
  }

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          email: "alice@example.com",
          phone: "555-0100",
        },
        id: "0",
        subPath: ["recipient"],
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
          phone: "555-0100",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not surface incomplete cached fields inside a list item `@defer` boundary while sibling items are clean defer gaps with returnPartialData: false", async () => {
  const query = gql`
    query {
      person {
        id
        friends {
          id
          ... @defer {
            email
            phone
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        person: {
          __typename: "Person",
          id: "1",
          friends: [
            {
              __typename: "Person",
              id: "2",
              email: "cached-leia@example.com",
            },
            {
              __typename: "Person",
              id: "3",
            },
          ],
        },
      },
    });
  }

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2" },
          { __typename: "Person", id: "3" },
        ],
      },
    },
    pending: [
      { id: "0", path: ["person", "friends", 0] },
      { id: "1", path: ["person", "friends", 1] },
    ],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2" },
          { __typename: "Person", id: "3" },
        ],
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          email: "leia@example.com",
          phone: "555-0102",
        },
        id: "0",
      },
      {
        data: {
          __typename: "Person",
          email: "han@example.com",
          phone: "555-0103",
        },
        id: "1",
      },
    ],
    completed: [{ id: "0" }, { id: "1" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          {
            __typename: "Person",
            id: "2",
            email: "leia@example.com",
            phone: "555-0102",
          },
          {
            __typename: "Person",
            id: "3",
            email: "han@example.com",
            phone: "555-0103",
          },
        ],
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not surface incomplete cached fields inside a later sibling `@defer` boundary while an earlier sibling is still pending with returnPartialData: false", async () => {
  const query = gql`
    query {
      greeting {
        message
        ... @defer {
          signature
        }
        ... @defer {
          recipient {
            name
            email
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  {
    using _ = spyOnConsole("error");
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
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [
      { id: "0", path: ["greeting"], label: "ac_0" },
      { id: "1", path: ["greeting"], label: "ac_1" },
    ],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: {
            __typename: "Person",
            name: "Alice",
            email: "alice@example.com",
          },
        },
        id: "1",
      },
    ],
    completed: [{ id: "1" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          signature: "From Apollo",
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
        signature: "From Apollo",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not surface incomplete cached deep defer-only fields under an overlapped path with returnPartialData: false", async () => {
  const query = gql`
    query {
      greeting {
        message
        recipient {
          address {
            city
          }
        }
        ... on Greeting @defer {
          recipient {
            address {
              city
              postalCode
              line2
            }
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          recipient: {
            __typename: "Person",
            address: {
              __typename: "Address",
              city: "Cached City",
              postalCode: "00000",
            },
          },
        },
      },
    });
  }

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          address: { __typename: "Address", city: "New York" },
        },
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          address: {
            __typename: "Address",
            city: "New York",
          },
        },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Address",
          postalCode: "10001",
          line2: "Apt 4",
        },
        id: "0",
        subPath: ["recipient", "address"],
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          address: {
            __typename: "Address",
            city: "New York",
            postalCode: "10001",
            line2: "Apt 4",
          },
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not treat cached `__typename`-only data inside a `@defer` boundary as incomplete deferred fields with returnPartialData: false", async () => {
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query: gql`
        query {
          greeting {
            message
            recipient {
              __typename
            }
          }
        }
      `,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Cached",
          recipient: { __typename: "Person" },
        },
      },
    });
  }

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: {
            __typename: "Person",
            name: "Alice",
            email: "alice@example.com",
          },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('returns partial non-deferred cached data with a "cache-first" fetch policy and returnPartialData', async () => {
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
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  // We are intentionally writing partial data to the cache. Suppress console
  // warnings to avoid unnecessary noise in the test.
  {
    using _consoleSpy = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Cached hello",
        },
      },
    });
  }

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      fetchPolicy: "cache-first",
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Cached hello",
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

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

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('returns partial deferred cached data as "partial" while streaming with a "cache-first" fetch policy and returnPartialData', async () => {
  // Suppress expected missing field warning when writing partial value after
  // first chunk
  using _ = spyOnConsole("error");
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            email
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
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      fetchPolicy: "cache-first",
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          recipient: {
            name: "Alice",
            email: "alice@example.com",
            __typename: "Person",
          },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports partial cached data inside a defer boundary as "partial" when the boundary completes with errors with a "cache-first" fetch policy and returnPartialData', async () => {
  // Suppress expected missing field warning when writing partial value after
  // first chunk
  using _ = spyOnConsole("error");
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            email
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
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      returnPartialData: true,
      errorPolicy: "all",
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    completed: [
      {
        id: "0",
        errors: [
          {
            message: "Could not fetch recipient",
            path: ["greeting", "recipient"],
          },
        ],
      },
    ],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    error: new CombinedGraphQLErrors({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
      errors: [
        {
          message: "Could not fetch recipient",
          path: ["greeting", "recipient"],
        },
      ],
    }),
    loading: false,
    networkStatus: NetworkStatus.error,
    partial: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("reports partial data correctly when a mid-stream request is abandoned and the query is subscribed to again", async () => {
  // Suppress expected missing field warning when writing partial value after
  // first chunk
  using _ = spyOnConsole("error");
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }
  `;

  const defer1 = mockDeferStreamGraphQL17Alpha9();
  const defer2 = mockDeferStreamGraphQL17Alpha9();
  let requests = 0;
  const link = ApolloLink.from([
    new ApolloLink((operation, forward) => {
      requests++;
      return forward(operation);
    }),
    ApolloLink.split(() => requests === 1, defer1.httpLink, defer2.httpLink),
  ]);

  const cache = new InMemoryCache();
  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const observable = client.watchQuery({ query, returnPartialData: true });

  const initialChunk = {
    data: { greeting: { __typename: "Greeting", message: "Hello world" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  };

  const streamA = new ObservableStream(observable);

  await expect(streamA).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  defer1.enqueueInitialChunk({ ...initialChunk });

  await expect(streamA).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  // Abandon the request before the boundary is delivered.
  streamA.unsubscribe();

  const streamB = new ObservableStream(observable);

  await expect(streamB).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  defer2.enqueueInitialChunk({ ...initialChunk });

  await expect(streamB).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  defer2.enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          recipient: {
            name: "Alice",
            email: "alice@example.com",
            __typename: "Person",
          },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(streamB).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(streamB).not.toEmitAnything();
});

test("emits empty then streaming results for deferred queries with no data in the cache and returnPartialData", async () => {
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
    mockDeferStreamGraphQL17Alpha9();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      fetchPolicy: "cache-first",
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          recipient: {
            name: "Alice",
            __typename: "Person",
          },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports overlapping deferred and non-deferred fields as "streaming" when only the deferred-only fields are missing', async () => {
  // Suppress expected missing field write warnings since defer context is reset.
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        recipient {
          name
        }
        ... on Greeting @defer {
          recipient {
            name
            email
          }
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

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      fetchPolicy: "cache-first",
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  // `recipient.name` is guaranteed by the non-deferred selection; only
  // `recipient.email` is deferred and still in flight, so the result is
  // reported as streaming rather than partial.
  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          email: "alice@example.com",
        },
        id: "0",
        subPath: ["recipient"],
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports "streaming" when non-deferred fields for the same response key are split across sibling selection sets', async () => {
  // Suppress expected missing field write warnings since defer context is reset.
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        recipient {
          name
        }
        recipient {
          email
        }
        ... on Greeting @defer {
          recipient {
            name
            email
            id
          }
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

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          id: "1",
        },
        id: "0",
        subPath: ["recipient"],
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
          id: "1",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports "streaming" when non-deferred fields for the same response key come from a field and a fragment', async () => {
  // Suppress expected missing field write warnings since defer context is reset.
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        recipient {
          name
        }
        ... on Greeting {
          recipient {
            email
          }
        }
        ... on Greeting @defer {
          recipient {
            name
            email
            id
          }
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

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          id: "1",
        },
        id: "0",
        subPath: ["recipient"],
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
          id: "1",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports "streaming" when nested non-deferred fields are split across sibling selection sets', async () => {
  // Suppress expected missing field write warnings since defer context is reset.
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        recipient {
          name
          bestFriend {
            name
          }
        }
        recipient {
          email
          bestFriend {
            email
          }
        }
        ... on Greeting @defer {
          recipient {
            name
            email
            id
            bestFriend {
              name
              email
              phone
            }
          }
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

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
          bestFriend: {
            __typename: "Person",
            name: "Bob",
            email: "bob@example.com",
          },
        },
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  // All non-deferred paths are present, including nested `bestFriend` fields
  // split across sibling selections. Only deferred-only `id` and
  // `bestFriend.phone` are still missing.
  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
          bestFriend: {
            __typename: "Person",
            name: "Bob",
            email: "bob@example.com",
          },
        },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          id: "1",
          bestFriend: {
            __typename: "Person",
            phone: "555-0100",
          },
        },
        id: "0",
        subPath: ["recipient"],
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
          id: "1",
          bestFriend: {
            __typename: "Person",
            name: "Bob",
            email: "bob@example.com",
            phone: "555-0100",
          },
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports "streaming" when one of multiple sibling `@defer` fragments has fully arrived and another is still pending', async () => {
  const query = gql`
    query {
      greeting {
        message
        ... @defer {
          recipient {
            name
          }
        }
        ... @defer {
          signature
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

  const stream = new ObservableStream(
    client.watchQuery({ query, returnPartialData: true })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [
      { id: "0", path: ["greeting"], label: "ac_0" },
      { id: "1", path: ["greeting"], label: "ac_1" },
    ],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  // One deferred fragment completes while the other is still in flight. The
  // arrived fragment is fully satisfied (`recipient`); only `signature` remains
  // as a clean defer gap. That must stay "streaming", not flip to "partial"
  // just because some deferred selection is now present in the result.
  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: { __typename: "Person", name: "Alice" },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          signature: "From Apollo",
        },
        id: "1",
      },
    ],
    completed: [{ id: "1" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
        signature: "From Apollo",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('treats `@defer(if: false)` as a non-deferred fragment with a "cache-first" fetch policy and returnPartialData', async () => {
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer(if: false) {
          recipient {
            name
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk } = mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  // We are intentionally writing partial data to the cache. Suppress console
  // warnings to avoid unnecessary noise in the test.
  {
    using _consoleSpy = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Cached hello",
        },
      },
    });
  }

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      fetchPolicy: "cache-first",
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Cached hello",
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    pending: [],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('evaluates `@defer(if: $variable)` as non-deferred when the variable is false, reporting "streaming" while a sibling `@defer` is pending', async () => {
  const query = gql`
    query ($shouldDefer: Boolean!) {
      greeting {
        message
        ... on Greeting @defer(if: $shouldDefer) {
          recipient {
            name
          }
        }
        ... on Greeting @defer {
          signature
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

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      returnPartialData: true,
      variables: { shouldDefer: false },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    pending: [{ id: "0", path: ["greeting"], label: "ac_1" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          signature: "From Apollo",
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
        signature: "From Apollo",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('evaluates `@defer(if: $variable)` as deferred when the variable is true, reporting "streaming" while deferred fields are pending', async () => {
  const query = gql`
    query ($shouldDefer: Boolean!) {
      greeting {
        message
        ... on Greeting @defer(if: $shouldDefer) {
          recipient {
            name
          }
        }
        ... on Greeting @defer {
          signature
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

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      returnPartialData: true,
      variables: { shouldDefer: true },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [
      { id: "0", path: ["greeting"], label: "ac_0" },
      { id: "1", path: ["greeting"], label: "ac_1" },
    ],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: { message: "Hello world", __typename: "Greeting" },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: { __typename: "Person", name: "Alice" },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          signature: "From Apollo",
        },
        id: "1",
      },
    ],
    completed: [{ id: "1" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
        signature: "From Apollo",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("evaluates `@defer(if: $variable)` for overlapping fields so disabled-defer selections stay non-deferred", async () => {
  // Suppress expected missing field write warnings since defer context is reset.
  using _ = spyOnConsole("error");

  const query = gql`
    query ($shouldDefer: Boolean!) {
      greeting {
        message
        ... on Greeting @defer(if: $shouldDefer) {
          recipient {
            name
          }
        }
        ... on Greeting @defer {
          recipient {
            name
            email
          }
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

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      returnPartialData: true,
      variables: { shouldDefer: false },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    pending: [{ id: "0", path: ["greeting"], label: "ac_1" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          email: "alice@example.com",
        },
        id: "0",
        subPath: ["recipient"],
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports "streaming" instead of "partial" when the only unfulfilled field of a deferred fragment is excluded by `@skip`', async () => {
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            email @skip(if: true)
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  // We are intentionally writing partial data to the cache. Suppress console
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
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      fetchPolicy: "cache-first",
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    // `email` is excluded by `@skip`, so the deferred fragment is fully
    // satisfied by the cached `name` and should report complete while streaming.
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: false,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: { __typename: "Person", name: "Alice" },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("reports the correct data state for `@defer` on a named fragment spread with partial cached data", async () => {
  // Suppress expected missing field warning when writing partial value after
  // first chunk
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        ...GreetingRecipient @defer
      }
    }

    fragment GreetingRecipient on Greeting {
      recipient {
        name
        email
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
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      fetchPolicy: "cache-first",
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: {
            __typename: "Person",
            name: "Alice",
            email: "alice@example.com",
          },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports overlapping fields contributed by a non-deferred fragment spread as "streaming"', async () => {
  // Suppress expected missing field write warnings since defer context is reset.
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        ...GreetingRecipient
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }

    fragment GreetingRecipient on Greeting {
      recipient {
        name
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

  const stream = new ObservableStream(
    client.watchQuery({ query, returnPartialData: true })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          email: "alice@example.com",
        },
        id: "0",
        subPath: ["recipient"],
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports overlapping fields contributed by a non-deferred inline fragment as "streaming"', async () => {
  // Suppress expected missing field write warnings since defer context is reset.
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        ... on Greeting {
          recipient {
            name
          }
        }
        ... on Greeting @defer {
          recipient {
            name
            email
          }
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

  const stream = new ObservableStream(
    client.watchQuery({ query, returnPartialData: true })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          email: "alice@example.com",
        },
        id: "0",
        subPath: ["recipient"],
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("treats nested fragments inside a `@defer` boundary when deciding if the fragment has started", async () => {
  // Suppress expected missing field warning when writing partial value after
  // first chunk
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          ... on Greeting {
            recipient {
              name
            }
            signature
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
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, returnPartialData: true })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: { __typename: "Person", name: "Alice" },
          signature: "From Apollo",
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
        signature: "From Apollo",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("treats a named fragment spread inside a `@defer` boundary when deciding if the fragment has started", async () => {
  // Suppress expected missing field warning when writing partial value after
  // first chunk
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          ...DeferredGreeting
        }
      }
    }

    fragment DeferredGreeting on Greeting {
      recipient {
        name
      }
      signature
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
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, returnPartialData: true })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: { __typename: "Person", name: "Alice" },
          signature: "From Apollo",
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
        signature: "From Apollo",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports "partial" when a nested defer-only field is present under an overlapping parent while another defer-only field is still missing', async () => {
  // Suppress expected missing field warning when writing partial value after
  // first chunk
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        recipient {
          name
        }
        ... on Greeting @defer {
          recipient {
            name
            email
            phone
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
        recipient: {
          __typename: "Person",
          name: "Cached Alice",
          email: "cached@example.com",
        },
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: {
          __typename: "Person",
          name: "Cached Alice",
          email: "cached@example.com",
        },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "cached@example.com",
        },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          email: "alice@example.com",
          phone: "555-0100",
        },
        id: "0",
        subPath: ["recipient"],
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
          phone: "555-0100",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("merges non-deferred selections that contribute different subfields under the same response key", async () => {
  // Suppress expected missing field write warnings since defer context is reset.
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        ...RecipientName
        ...RecipientId
        ... on Greeting @defer {
          recipient {
            id
            name
            email
          }
        }
      }
    }

    fragment RecipientName on Greeting {
      recipient {
        name
      }
    }

    fragment RecipientId on Greeting {
      recipient {
        id
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

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", id: "1", name: "Alice" },
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", id: "1", name: "Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          email: "alice@example.com",
        },
        id: "0",
        subPath: ["recipient"],
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          id: "1",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports overlapping fields from a fragment spread repeated at the same selection-set level as "streaming"', async () => {
  // Suppress expected missing field write warnings since defer context is reset.
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        recipient {
          id
          ...PersonName
          ...PersonName
        }
        ... on Greeting @defer {
          recipient {
            ...PersonName
            email
          }
        }
      }
    }

    fragment PersonName on Person {
      name
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", id: "1", name: "Alice" },
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", id: "1", name: "Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  // `name` was already delivered non-deferred via `PersonName`; only exclusive
  // `email` arrives on the deferred pending (graphql.js uses `subPath`).
  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          email: "alice@example.com",
        },
        id: "0",
        subPath: ["recipient"],
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          id: "1",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports overlapping fields from the same fragment spread used at different selection-set levels as "streaming"', async () => {
  // Suppress expected missing field write warnings since defer context is reset.
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        recipient {
          ...PersonName
          bestFriend {
            ...PersonName
          }
        }
        ... on Greeting @defer {
          recipient {
            ...PersonName
            email
            bestFriend {
              ...PersonName
              email
            }
          }
        }
      }
    }

    fragment PersonName on Person {
      name
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          bestFriend: { __typename: "Person", name: "Bob" },
        },
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          bestFriend: { __typename: "Person", name: "Bob" },
        },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          email: "bob@example.com",
        },
        id: "0",
        subPath: ["recipient", "bestFriend"],
      },
      {
        data: {
          __typename: "Person",
          email: "alice@example.com",
        },
        id: "0",
        subPath: ["recipient"],
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
          bestFriend: {
            __typename: "Person",
            name: "Bob",
            email: "bob@example.com",
          },
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports per-item `@defer` gaps on a list as "streaming" when every item is still pending', async () => {
  const query = gql`
    query {
      person {
        id
        friends {
          id
          ... @defer {
            name
          }
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

  const stream = new ObservableStream(
    client.watchQuery({ query, returnPartialData: true })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2" },
          { __typename: "Person", id: "3" },
        ],
      },
    },
    pending: [
      { id: "0", path: ["person", "friends", 0] },
      { id: "1", path: ["person", "friends", 1] },
    ],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2" },
          { __typename: "Person", id: "3" },
        ],
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: { __typename: "Person", name: "Leia" },
        id: "0",
      },
      {
        data: { __typename: "Person", name: "Han" },
        id: "1",
      },
    ],
    completed: [{ id: "0" }, { id: "1" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2", name: "Leia" },
          { __typename: "Person", id: "3", name: "Han" },
        ],
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports "streaming" when one list item\'s `@defer` has arrived and another item is still pending', async () => {
  const query = gql`
    query {
      person {
        id
        friends {
          id
          ... @defer {
            name
          }
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

  const stream = new ObservableStream(
    client.watchQuery({ query, returnPartialData: true })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2" },
          { __typename: "Person", id: "3" },
        ],
      },
    },
    pending: [
      { id: "0", path: ["person", "friends", 0] },
      { id: "1", path: ["person", "friends", 1] },
    ],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2" },
          { __typename: "Person", id: "3" },
        ],
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: { __typename: "Person", name: "Leia" },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2", name: "Leia" },
          { __typename: "Person", id: "3" },
        ],
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: { __typename: "Person", name: "Han" },
        id: "1",
      },
    ],
    completed: [{ id: "1" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2", name: "Leia" },
          { __typename: "Person", id: "3", name: "Han" },
        ],
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports overlapping deferred and non-deferred list fields as "streaming" when only defer-only item fields are missing', async () => {
  // Suppress expected missing field write warnings since defer context is reset.
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      person {
        id
        friends {
          id
          name
        }
        ... on Person @defer {
          friends {
            id
            name
            email
          }
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

  const stream = new ObservableStream(
    client.watchQuery({ query, returnPartialData: true })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2", name: "Leia" },
          { __typename: "Person", id: "3", name: "Han" },
        ],
      },
    },
    pending: [{ id: "0", path: ["person"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2", name: "Leia" },
          { __typename: "Person", id: "3", name: "Han" },
        ],
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          email: "leia@example.com",
        },
        id: "0",
        subPath: ["friends", 0],
      },
      {
        data: {
          __typename: "Person",
          email: "han@example.com",
        },
        id: "0",
        subPath: ["friends", 1],
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          {
            __typename: "Person",
            id: "2",
            name: "Leia",
            email: "leia@example.com",
          },
          {
            __typename: "Person",
            id: "3",
            name: "Han",
            email: "han@example.com",
          },
        ],
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports "partial" when one list item has a started `@defer` that is still incomplete while other items are only clean defer gaps', async () => {
  // Suppress expected missing field warning when writing partial list items.
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      person {
        id
        friends {
          id
          ... @defer {
            email
            phone
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
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          {
            __typename: "Person",
            id: "2",
            email: "cached-leia@example.com",
          },
          {
            __typename: "Person",
            id: "3",
          },
        ],
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          {
            __typename: "Person",
            id: "2",
            email: "cached-leia@example.com",
          },
          {
            __typename: "Person",
            id: "3",
          },
        ],
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2" },
          { __typename: "Person", id: "3" },
        ],
      },
    },
    pending: [
      { id: "0", path: ["person", "friends", 0] },
      { id: "1", path: ["person", "friends", 1] },
    ],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          {
            __typename: "Person",
            id: "2",
            email: "cached-leia@example.com",
          },
          {
            __typename: "Person",
            id: "3",
          },
        ],
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          email: "leia@example.com",
          phone: "555-0102",
        },
        id: "0",
      },
      {
        data: {
          __typename: "Person",
          email: "han@example.com",
          phone: "555-0103",
        },
        id: "1",
      },
    ],
    completed: [{ id: "0" }, { id: "1" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          {
            __typename: "Person",
            id: "2",
            email: "leia@example.com",
            phone: "555-0102",
          },
          {
            __typename: "Person",
            id: "3",
            email: "han@example.com",
            phone: "555-0103",
          },
        ],
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports `@defer` nested under a field as "streaming" when only the nested deferred fields are missing', async () => {
  const query = gql`
    query {
      greeting {
        message
        recipient {
          name
          ... on Person @defer {
            email
          }
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

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    pending: [{ id: "0", path: ["greeting", "recipient"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          email: "alice@example.com",
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports "partial" when a later `@defer` boundary is incomplete and an earlier sibling `@defer` is still fully pending', async () => {
  // Suppress expected missing field write warnings since defer context is reset.
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        ... @defer {
          signature
        }
        ... @defer {
          recipient {
            name
            email
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  // Seed only `recipient.name` so the second boundary is already mixed once
  // the initial network chunk arrives (name present, email still missing).
  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, returnPartialData: true })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [
      { id: "0", path: ["greeting"], label: "ac_0" },
      { id: "1", path: ["greeting"], label: "ac_1" },
    ],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: {
            __typename: "Person",
            name: "Alice",
            email: "alice@example.com",
          },
        },
        id: "1",
      },
    ],
    completed: [{ id: "1" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          signature: "From Apollo",
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
        signature: "From Apollo",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports "streaming" when two `@defer` fragments overlap and only the second fragment\'s exclusive fields are missing', async () => {
  // Suppress expected missing field write warnings since defer context is reset.
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        ... @defer {
          recipient {
            name
          }
        }
        ... @defer {
          recipient {
            name
            email
          }
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

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [
      { id: "0", path: ["greeting"], label: "ac_0" },
      { id: "1", path: ["greeting"], label: "ac_1" },
    ],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: { __typename: "Person", name: "Alice" },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          email: "alice@example.com",
        },
        id: "1",
        subPath: ["recipient"],
      },
    ],
    completed: [{ id: "1" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('keeps a delivered `@defer` fragment\'s fields while a sibling fragment at the same path is still pending with a "network-only" fetch policy', async () => {
  // Suppress expected missing field write warnings since defer context is reset.
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        ... @defer {
          recipient {
            name
          }
        }
        ... @defer {
          recipient {
            name
            email
          }
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

  const stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [
      { id: "0", path: ["greeting"], label: "ac_0" },
      { id: "1", path: ["greeting"], label: "ac_1" },
    ],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: { __typename: "Greeting", message: "Hello world" },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: { recipient: { __typename: "Person", name: "Alice" } },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: { __typename: "Person", email: "alice@example.com" },
        id: "1",
        subPath: ["recipient"],
      },
    ],
    completed: [{ id: "1" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports "partial" when a deep defer-only field is present under an overlapped path while another deep defer-only field is still missing', async () => {
  // Suppress expected missing field warning when writing partial nested values.
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        recipient {
          address {
            city
          }
        }
        ... on Greeting @defer {
          recipient {
            address {
              city
              postalCode
              line2
            }
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  // `postalCode` is defer-only and already present; `line2` is still missing.
  // Presence must be detected under the overlapped `recipient.address` path.
  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: {
          __typename: "Person",
          address: {
            __typename: "Address",
            city: "Cached City",
            postalCode: "00000",
          },
        },
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: {
          __typename: "Person",
          address: {
            __typename: "Address",
            city: "Cached City",
            postalCode: "00000",
          },
        },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          address: { __typename: "Address", city: "New York" },
        },
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          address: {
            __typename: "Address",
            city: "New York",
            postalCode: "00000",
          },
        },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Address",
          postalCode: "10001",
          line2: "Apt 4",
        },
        id: "0",
        subPath: ["recipient", "address"],
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          address: {
            __typename: "Address",
            city: "New York",
            postalCode: "10001",
            line2: "Apt 4",
          },
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports overlapping fields gated by `@include` as "streaming" when the included non-deferred fields are present and only defer-only fields are missing', async () => {
  // Suppress expected missing field write warnings since defer context is reset.
  using _ = spyOnConsole("error");

  const query = gql`
    query ($includeRecipient: Boolean!) {
      greeting {
        message
        recipient @include(if: $includeRecipient) {
          name
        }
        ... on Greeting @defer {
          recipient {
            name
            email
          }
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

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      variables: { includeRecipient: true },
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  // Classifier must honor `@include` via operation variables: `name` is
  // non-deferred when included, so only missing `email` stays "streaming".
  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          email: "alice@example.com",
        },
        id: "0",
        subPath: ["recipient"],
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports "streaming" when `@defer(if: false)` fields arrive in the initial payload while another `@defer` is still pending', async () => {
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer(if: false) {
          recipient {
            name
          }
        }
        ... on Greeting @defer {
          signature
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

  const stream = new ObservableStream(
    client.watchQuery({ query, returnPartialData: true })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    pending: [{ id: "0", path: ["greeting"], label: "ac_1" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          signature: "From Apollo",
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
        signature: "From Apollo",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("uses response aliases when matching overlapping non-deferred and deferred fields", async () => {
  // Suppress expected missing field write warnings since defer context is reset.
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        user: recipient {
          name
        }
        ... on Greeting @defer {
          user: recipient {
            name
            email
          }
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

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        user: { __typename: "Person", name: "Alice" },
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        user: { __typename: "Person", name: "Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          email: "alice@example.com",
        },
        id: "0",
        subPath: ["user"],
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        user: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports "streaming" for nested `@defer` when the outer fragment has arrived and the inner fragment is still pending', async () => {
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            ... on Person @defer {
              email
            }
          }
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

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  // Outer defer arrives with `recipient.name`; inner email defer is still
  // pending at a nested path.
  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: { __typename: "Person", name: "Alice" },
        },
        id: "0",
      },
    ],
    pending: [{ id: "1", path: ["greeting", "recipient"] }],
    completed: [{ id: "0" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Person",
          email: "alice@example.com",
        },
        id: "1",
      },
    ],
    completed: [{ id: "1" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not treat `__typename`-only presence under a `@defer` as the fragment having started", async () => {
  // Suppress expected missing field write warnings since defer context is reset.
  using _ = spyOnConsole("error");

  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  cache.writeQuery({
    query: gql`
      query {
        greeting {
          message
          recipient {
            __typename
          }
        }
      }
    `,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Cached",
        recipient: { __typename: "Person" },
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, returnPartialData: true })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Cached",
        recipient: { __typename: "Person" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: {
            __typename: "Person",
            name: "Alice",
            email: "alice@example.com",
          },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports residual deferred cached data as "complete" while streaming with a "cache-first" fetch policy and returnPartialData', async () => {
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
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  // We are intentionally writing partial data to the cache. Suppress console
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
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      fetchPolicy: "cache-first",
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  // Selection set is fully satisfied from network message + residual cached
  // recipient, so dataState is complete even though the stream is still open.
  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: false,
  });

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

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('reports complete cached deferred data as "complete" while streaming with a "cache-and-network" fetch policy', async () => {
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
    mockDeferStreamGraphQL17Alpha9();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
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

  const stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "cache-and-network" })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        message: "Hello cached",
        __typename: "Greeting",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: false,
  });

  enqueueInitialChunk({
    data: { greeting: { __typename: "Greeting", message: "Hello world" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  // Residual cached recipient keeps the selection set complete while the
  // deferred network chunk is still pending.
  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: false,
  });

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

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('does not return complete cached deferred data while streaming with a "network-only" fetch policy', async () => {
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
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Cached hello",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { __typename: "Greeting", message: "Hello world" } },
    pending: [{ id: "0", path: ["greeting"], label: "ac_0" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: { __typename: "Greeting", message: "Hello world" },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Alice" },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('keeps a non-deferred fragment\'s fields at a path with a pending defer boundary with a "network-only" fetch policy', async () => {
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting {
          tone
        }
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

  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Cached hello",
        tone: "cheerful",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        tone: "warm",
      },
    },
    pending: [{ id: "0", path: ["greeting"], label: "ac_0" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        tone: "warm",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Alice" },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        tone: "warm",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('does not return complete cached deferred data when a defer boundary completes with errors with a "network-only" fetch policy', async () => {
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
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Cached hello",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      fetchPolicy: "network-only",
      errorPolicy: "all",
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { __typename: "Greeting", message: "Hello world" } },
    pending: [{ id: "0", path: ["greeting"], label: "ac_0" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: { __typename: "Greeting", message: "Hello world" },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    completed: [
      {
        id: "0",
        errors: [
          {
            message: "Could not fetch recipient",
            path: ["greeting", "recipient"],
          },
        ],
      },
    ],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: { __typename: "Greeting", message: "Hello world" },
    }),
    dataState: "streaming",
    error: new CombinedGraphQLErrors({
      data: { greeting: { __typename: "Greeting", message: "Hello world" } },
      errors: [
        {
          message: "Could not fetch recipient",
          path: ["greeting", "recipient"],
        },
      ],
    }),
    loading: false,
    networkStatus: NetworkStatus.error,
    partial: true,
  });

  await expect(stream).not.toEmitAnything();
});

test('does not return complete cached deferred data when a defer boundary completes with errors with a "network-only" fetch policy and errorPolicy "none"', async () => {
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
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Cached hello",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { __typename: "Greeting", message: "Hello world" } },
    pending: [{ id: "0", path: ["greeting"], label: "ac_0" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: { __typename: "Greeting", message: "Hello world" },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    completed: [
      {
        id: "0",
        errors: [
          {
            message: "Could not fetch recipient",
            path: ["greeting", "recipient"],
          },
        ],
      },
    ],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: { __typename: "Greeting", message: "Hello world" },
    }),
    dataState: "streaming",
    error: new CombinedGraphQLErrors({
      data: { greeting: { __typename: "Greeting", message: "Hello world" } },
      errors: [
        {
          message: "Could not fetch recipient",
          path: ["greeting", "recipient"],
        },
      ],
    }),
    loading: false,
    networkStatus: NetworkStatus.error,
    partial: true,
  });

  await expect(stream).not.toEmitAnything();
});

test('does not return a partial cached defer boundary while streaming with a "network-only" fetch policy', async () => {
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  {
    using _consoleSpy = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Cached hello",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
    });
  }

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  {
    using _consoleSpy = spyOnConsole("error");
    enqueueInitialChunk({
      data: { greeting: { __typename: "Greeting", message: "Hello world" } },
      pending: [{ id: "0", path: ["greeting"] }],
      hasNext: true,
    });

    await expect(stream).toEmitTypedValue({
      data: markAsStreaming({
        greeting: { __typename: "Greeting", message: "Hello world" },
      }),
      dataState: "streaming",
      loading: true,
      networkStatus: NetworkStatus.streaming,
      partial: true,
    });
  }

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          recipient: {
            __typename: "Person",
            name: "Alice",
            email: "alice@example.com",
          },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('does not return cached non-deferred data through a clean defer boundary while streaming with a "network-only" fetch policy', async () => {
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
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  {
    using _consoleSpy = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Cached hello",
        },
      },
    });
  }

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { __typename: "Greeting", message: "Hello world" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: { __typename: "Greeting", message: "Hello world" },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Alice" },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('does not return cached defer boundaries for list items while streaming with a "network-only" fetch policy', async () => {
  const query = gql`
    query {
      person {
        id
        friends {
          id
          ... @defer {
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
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2", name: "Cached Leia" },
          { __typename: "Person", id: "3", name: "Cached Han" },
        ],
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2" },
          { __typename: "Person", id: "3" },
        ],
      },
    },
    pending: [
      { id: "0", path: ["person", "friends", 0], label: "ac_0" },
      { id: "1", path: ["person", "friends", 1], label: "ac_0" },
    ],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2" },
          { __typename: "Person", id: "3" },
        ],
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      { data: { __typename: "Person", name: "Leia" }, id: "0" },
      { data: { __typename: "Person", name: "Han" }, id: "1" },
    ],
    completed: [{ id: "0" }, { id: "1" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2", name: "Leia" },
          { __typename: "Person", id: "3", name: "Han" },
        ],
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('prunes a list item\'s cached defer boundary while a sibling item has already streamed in with a "network-only" fetch policy', async () => {
  const query = gql`
    query {
      person {
        id
        friends {
          id
          ... @defer {
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
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2", name: "Cached Leia" },
          { __typename: "Person", id: "3", name: "Cached Han" },
        ],
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2" },
          { __typename: "Person", id: "3" },
        ],
      },
    },
    pending: [
      { id: "0", path: ["person", "friends", 0], label: "ac_0" },
      { id: "1", path: ["person", "friends", 1], label: "ac_0" },
    ],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2" },
          { __typename: "Person", id: "3" },
        ],
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [{ data: { __typename: "Person", name: "Leia" }, id: "0" }],
    hasNext: true,
    completed: [{ id: "0" }],
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2", name: "Leia" },
          { __typename: "Person", id: "3" },
        ],
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [{ data: { __typename: "Person", name: "Han" }, id: "1" }],
    completed: [{ id: "1" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2", name: "Leia" },
          { __typename: "Person", id: "3", name: "Han" },
        ],
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('prunes each list item\'s sibling `@defer` boundaries independently by label with a "network-only" fetch policy', async () => {
  const query = gql`
    query {
      person {
        id
        friends {
          id
          ... @defer {
            name
          }
          ... @defer {
            email
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
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          {
            __typename: "Person",
            id: "2",
            name: "Cached Leia",
            email: "cached-leia@example.com",
          },
          {
            __typename: "Person",
            id: "3",
            name: "Cached Han",
            email: "cached-han@example.com",
          },
        ],
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2" },
          { __typename: "Person", id: "3" },
        ],
      },
    },
    pending: [
      { id: "0", path: ["person", "friends", 0], label: "ac_0" },
      { id: "1", path: ["person", "friends", 0], label: "ac_1" },
      { id: "2", path: ["person", "friends", 1], label: "ac_0" },
      { id: "3", path: ["person", "friends", 1], label: "ac_1" },
    ],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2" },
          { __typename: "Person", id: "3" },
        ],
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [{ data: { __typename: "Person", name: "Leia" }, id: "0" }],
    completed: [{ id: "0" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2", name: "Leia" },
          { __typename: "Person", id: "3" },
        ],
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      { data: { __typename: "Person", email: "han@example.com" }, id: "3" },
    ],
    completed: [{ id: "3" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2", name: "Leia" },
          { __typename: "Person", id: "3", email: "han@example.com" },
        ],
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      { data: { __typename: "Person", email: "leia@example.com" }, id: "1" },
      { data: { __typename: "Person", name: "Han" }, id: "2" },
    ],
    completed: [{ id: "1" }, { id: "2" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          {
            __typename: "Person",
            id: "2",
            name: "Leia",
            email: "leia@example.com",
          },
          {
            __typename: "Person",
            id: "3",
            name: "Han",
            email: "han@example.com",
          },
        ],
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("prunes the right list item's defer boundary when a spread fragment's nested `@defer` shares a label across sibling boundaries", async () => {
  const query = gql`
    query {
      friendList {
        id
        ... @defer {
          name
          bestFriend {
            id
            ...FriendDetails
          }
        }
        ... @defer {
          email
          bestFriend {
            id
            ...FriendDetails
          }
        }
      }
    }

    fragment FriendDetails on Friend {
      ... @defer {
        name
      }
    }
  `;

  const cache = new InMemoryCache();

  cache.writeQuery({
    query,
    data: {
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Cached Luke",
          email: "cached-luke@example.com",
          bestFriend: {
            __typename: "Friend",
            id: "10",
            name: "Cached Leia",
          },
        },
        {
          __typename: "Friend",
          id: "2",
          name: "Cached Han",
          email: "cached-han@example.com",
          bestFriend: {
            __typename: "Friend",
            id: "20",
            name: "Cached Chewbacca",
          },
        },
      ],
    },
  });

  const name1 = promiseWithResolvers<void>();
  const email1 = promiseWithResolvers<void>();
  const details1 = promiseWithResolvers<void>();
  const name2 = promiseWithResolvers<void>();
  const email2 = promiseWithResolvers<void>();
  const details2 = promiseWithResolvers<void>();

  const client = new ApolloClient({
    cache,
    link: createSchemaLink({
      friendList: () => [
        {
          id: "1",
          name: () => name1.promise.then(() => "Luke"),
          email: () => email1.promise.then(() => "luke@example.com"),
          bestFriend: {
            id: "10",
            name: () => details1.promise.then(() => "Leia"),
          },
        },
        {
          id: "2",
          name: () => name2.promise.then(() => "Han"),
          email: () => email2.promise.then(() => "han@example.com"),
          bestFriend: {
            id: "20",
            name: () => details2.promise.then(() => "Chewbacca"),
          },
        },
      ],
    }),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );

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
        { __typename: "Friend", id: "1" },
        { __typename: "Friend", id: "2" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  name1.resolve();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          bestFriend: { __typename: "Friend", id: "10" },
        },
        { __typename: "Friend", id: "2" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  email1.resolve();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          email: "luke@example.com",
          bestFriend: { __typename: "Friend", id: "10" },
        },
        { __typename: "Friend", id: "2" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  details1.resolve();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          email: "luke@example.com",
          bestFriend: { __typename: "Friend", id: "10", name: "Leia" },
        },
        { __typename: "Friend", id: "2" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  name2.resolve();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          email: "luke@example.com",
          bestFriend: { __typename: "Friend", id: "10", name: "Leia" },
        },
        {
          __typename: "Friend",
          id: "2",
          name: "Han",
          bestFriend: { __typename: "Friend", id: "20" },
        },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  email2.resolve();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          email: "luke@example.com",
          bestFriend: { __typename: "Friend", id: "10", name: "Leia" },
        },
        {
          __typename: "Friend",
          id: "2",
          name: "Han",
          email: "han@example.com",
          bestFriend: { __typename: "Friend", id: "20" },
        },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  details2.resolve();

  await expect(stream).toEmitTypedValue({
    data: {
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          email: "luke@example.com",
          bestFriend: { __typename: "Friend", id: "10", name: "Leia" },
        },
        {
          __typename: "Friend",
          id: "2",
          name: "Han",
          email: "han@example.com",
          bestFriend: { __typename: "Friend", id: "20", name: "Chewbacca" },
        },
      ],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("prunes correctly when a spread fragment's nested `@defer` sits at the same path as the sibling boundaries that spread it", async () => {
  const query = gql`
    query {
      friendList {
        id
        ... @defer {
          name
          ...FriendDetails
        }
        ... @defer {
          email
          ...FriendDetails
        }
      }
    }

    fragment FriendDetails on Friend {
      ... @defer {
        nonNullName
      }
    }
  `;

  const cache = new InMemoryCache();

  cache.writeQuery({
    query,
    data: {
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Cached Luke",
          email: "cached-luke@example.com",
          nonNullName: "Cached Luke Skywalker",
        },
        {
          __typename: "Friend",
          id: "2",
          name: "Cached Han",
          email: "cached-han@example.com",
          nonNullName: "Cached Han Solo",
        },
      ],
    },
  });

  const name1 = promiseWithResolvers<void>();
  const email1 = promiseWithResolvers<void>();
  const details1 = promiseWithResolvers<void>();
  const name2 = promiseWithResolvers<void>();
  const email2 = promiseWithResolvers<void>();
  const details2 = promiseWithResolvers<void>();

  const client = new ApolloClient({
    cache,
    link: createSchemaLink({
      friendList: () => [
        {
          id: "1",
          name: () => name1.promise.then(() => "Luke"),
          email: () => email1.promise.then(() => "luke@example.com"),
          nonNullName: () => details1.promise.then(() => "Luke Skywalker"),
        },
        {
          id: "2",
          name: () => name2.promise.then(() => "Han"),
          email: () => email2.promise.then(() => "han@example.com"),
          nonNullName: () => details2.promise.then(() => "Han Solo"),
        },
      ],
    }),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );

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
        { __typename: "Friend", id: "1" },
        { __typename: "Friend", id: "2" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  name1.resolve();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  email1.resolve();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          email: "luke@example.com",
        },
        { __typename: "Friend", id: "2" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  details1.resolve();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          email: "luke@example.com",
          nonNullName: "Luke Skywalker",
        },
        { __typename: "Friend", id: "2" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  name2.resolve();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          email: "luke@example.com",
          nonNullName: "Luke Skywalker",
        },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  email2.resolve();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          email: "luke@example.com",
          nonNullName: "Luke Skywalker",
        },
        {
          __typename: "Friend",
          id: "2",
          name: "Han",
          email: "han@example.com",
        },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  details2.resolve();

  await expect(stream).toEmitTypedValue({
    data: {
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          email: "luke@example.com",
          nonNullName: "Luke Skywalker",
        },
        {
          __typename: "Friend",
          id: "2",
          name: "Han",
          email: "han@example.com",
          nonNullName: "Han Solo",
        },
      ],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("prunes correctly when the same spread fragment's nested `@defer` resolves to two different paths", async () => {
  const query = gql`
    query {
      friendList {
        id
        ... @defer {
          ...FriendDetails
        }
        ... @defer {
          bestFriend {
            id
            ...FriendDetails
          }
        }
      }
    }

    fragment FriendDetails on Friend {
      ... @defer {
        name
      }
    }
  `;

  const cache = new InMemoryCache();

  cache.writeQuery({
    query,
    data: {
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Cached Luke",
          bestFriend: {
            __typename: "Friend",
            id: "10",
            name: "Cached Leia",
          },
        },
        {
          __typename: "Friend",
          id: "2",
          name: "Cached Han",
          bestFriend: {
            __typename: "Friend",
            id: "20",
            name: "Cached Chewbacca",
          },
        },
      ],
    },
  });

  const bestFriend1 = promiseWithResolvers<void>();
  const itemName1 = promiseWithResolvers<void>();
  const bestFriendName1 = promiseWithResolvers<void>();
  const bestFriend2 = promiseWithResolvers<void>();
  const itemName2 = promiseWithResolvers<void>();
  const bestFriendName2 = promiseWithResolvers<void>();

  const client = new ApolloClient({
    cache,
    link: createSchemaLink({
      friendList: () => [
        {
          id: "1",
          name: () => itemName1.promise.then(() => "Luke"),
          bestFriend: () =>
            bestFriend1.promise.then(() => ({
              id: "10",
              name: () => bestFriendName1.promise.then(() => "Leia"),
            })),
        },
        {
          id: "2",
          name: () => itemName2.promise.then(() => "Han"),
          bestFriend: () =>
            bestFriend2.promise.then(() => ({
              id: "20",
              name: () => bestFriendName2.promise.then(() => "Chewbacca"),
            })),
        },
      ],
    }),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );

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
        { __typename: "Friend", id: "1" },
        { __typename: "Friend", id: "2" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  itemName1.resolve();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  bestFriend1.resolve();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          bestFriend: { __typename: "Friend", id: "10" },
        },
        { __typename: "Friend", id: "2" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  bestFriendName1.resolve();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          bestFriend: { __typename: "Friend", id: "10", name: "Leia" },
        },
        { __typename: "Friend", id: "2" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  itemName2.resolve();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          bestFriend: { __typename: "Friend", id: "10", name: "Leia" },
        },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  bestFriend2.resolve();

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          bestFriend: { __typename: "Friend", id: "10", name: "Leia" },
        },
        {
          __typename: "Friend",
          id: "2",
          name: "Han",
          bestFriend: { __typename: "Friend", id: "20" },
        },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  bestFriendName2.resolve();

  await expect(stream).toEmitTypedValue({
    data: {
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          bestFriend: { __typename: "Friend", id: "10", name: "Leia" },
        },
        {
          __typename: "Friend",
          id: "2",
          name: "Han",
          bestFriend: { __typename: "Friend", id: "20", name: "Chewbacca" },
        },
      ],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('does not leak complete or partial cached defer boundaries while streaming with a "network-only" fetch policy and returnPartialData: true', async () => {
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
      hero {
        id
        ... @defer {
          name
          email
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache();

  {
    using _consoleSpy = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Cached hello",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
        hero: { __typename: "Hero", id: "1", name: "Cached Luke" },
      },
    });
  }

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      fetchPolicy: "network-only",
      returnPartialData: true,
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: { __typename: "Greeting", message: "Hello world" },
      hero: { __typename: "Hero", id: "1" },
    },
    pending: [
      { id: "0", path: ["greeting"], label: "ac_0" },
      { id: "1", path: ["hero"], label: "ac_1" },
    ],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: { __typename: "Greeting", message: "Hello world" },
      hero: { __typename: "Hero", id: "1" },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Alice" },
        },
        id: "0",
      },
      {
        data: {
          __typename: "Hero",
          name: "Luke",
          email: "luke@example.com",
        },
        id: "1",
      },
    ],
    completed: [{ id: "0" }, { id: "1" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
      hero: {
        __typename: "Hero",
        id: "1",
        name: "Luke",
        email: "luke@example.com",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('keeps residual deferred cache data as "complete" while streaming after a refetch', async () => {
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
    mockDeferStreamGraphQL17Alpha9();

  const client = new ApolloClient({
    link: httpLink,
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const observable = client.watchQuery({ query });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { __typename: "Greeting", message: "Hello world" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: { name: "Alice", __typename: "Person" },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
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
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  const refetchPromise = observable.refetch();

  await expect(stream).toEmitTypedValue({
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
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Goodbye",
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  // Previous recipient remains in the cache, so the selection set is complete
  // even though the refetch deferred chunk has not arrived yet.
  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Goodbye",
        recipient: {
          __typename: "Person",
          name: "Alice",
        },
      },
    },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: false,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: { name: "Bob", __typename: "Person" },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
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
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

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

  await expect(stream).not.toEmitAnything();
});

test('keeps residual deferred cache data as "complete" while streaming after a refetch that previously had incremental errors', async () => {
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
    mockDeferStreamGraphQL17Alpha9();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const observable = client.watchQuery({ query, errorPolicy: "all" });
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
      hero: {
        name: "R2-D2",
        heroFriends: [
          { id: "1000", name: "Luke Skywalker" },
          { id: "1003", name: "Leia Organa" },
        ],
      },
    },
    pending: [
      { id: "0", path: ["hero", "heroFriends", 0] },
      { id: "1", path: ["hero", "heroFriends", 1] },
    ],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
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
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        id: "0",
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
        id: "1",
        data: {
          homeWorld: "Alderaan",
        },
      },
    ],
    completed: [{ id: "0" }, { id: "1" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      hero: {
        heroFriends: [
          { id: "1000", name: "Luke Skywalker", homeWorld: null },
          { id: "1003", name: "Leia Organa", homeWorld: "Alderaan" },
        ],
        name: "R2-D2",
      },
    },
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
          message: "homeWorld for character with ID 1000 could not be fetched.",
          path: ["hero", "heroFriends", 0, "homeWorld"],
        },
      ],
    }),
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.error,
    partial: false,
  });

  const refetchPromise = observable.refetch();

  await expect(stream).toEmitTypedValue({
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
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

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
    pending: [
      { id: "0", path: ["hero", "heroFriends", 0] },
      { id: "1", path: ["hero", "heroFriends", 1] },
    ],
    hasNext: true,
  });

  // Residual homeWorld values from the previous complete result keep the
  // selection set complete while deferred refetch chunks are still pending.
  await expect(stream).toEmitTypedValue({
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
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: false,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        id: "0",
        data: {
          homeWorld: "Alderaan",
        },
      },
      {
        id: "1",
        data: {
          homeWorld: "Alderaan",
        },
      },
    ],
    completed: [{ id: "0" }, { id: "1" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
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
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

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

  await expect(stream).not.toEmitAnything();
});

test("treats a deferred field delivered as null as fulfilled rather than still missing", async () => {
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
    mockDeferStreamGraphQL17Alpha9();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, returnPartialData: true })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { message: "Hello world", __typename: "Greeting" } },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          recipient: null,
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: null,
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('applies field read functions to in-flight results while pruning cached deferred data with a "network-only" fetch policy', async () => {
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
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache({
    typePolicies: {
      Greeting: {
        fields: {
          message: { read: uppercaseRead },
        },
      },
      Person: {
        fields: {
          name: { read: uppercaseRead },
        },
      },
    },
  });

  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Cached hello",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: { greeting: { __typename: "Greeting", message: "Hello world" } },
    pending: [{ id: "0", path: ["greeting"], label: "ac_0" }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: { __typename: "Greeting", message: "HELLO WORLD" },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Alice" },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "HELLO WORLD",
        recipient: { __typename: "Person", name: "ALICE" },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("applies field read functions to non-deferred fields while streaming deferred results", async () => {
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
    mockDeferStreamGraphQL17Alpha9();

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Greeting: {
          fields: {
            message: { read: uppercaseRead },
          },
        },
        Person: {
          fields: {
            name: { read: uppercaseRead },
          },
        },
      },
    }),
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "HELLO WORLD",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Alice" },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "HELLO WORLD",
        recipient: { __typename: "Person", name: "ALICE" },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("applies field read functions to partial non-deferred cached data before and after deferred network results", async () => {
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
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache({
    typePolicies: {
      Greeting: {
        fields: {
          message: { read: uppercaseRead },
        },
      },
      Person: {
        fields: {
          name: { read: uppercaseRead },
        },
      },
    },
  });

  // Intentionally write partial data (message only). Suppress missing-field
  // warnings from the cache write.
  {
    using _consoleSpy = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Cached hello",
        },
      },
    });
  }

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, returnPartialData: true })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "CACHED HELLO",
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "HELLO WORLD",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Alice" },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "HELLO WORLD",
        recipient: { __typename: "Person", name: "ALICE" },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("applies field read functions when partial cache data in a defer boundary is merged with streaming results", async () => {
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache({
    typePolicies: {
      Greeting: {
        fields: {
          message: { read: uppercaseRead },
        },
      },
      Person: {
        fields: {
          name: { read: uppercaseRead },
          email: { read: uppercaseRead },
        },
      },
    },
  });

  {
    using _consoleSpy = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          recipient: {
            __typename: "Person",
            name: "Cached Alice",
          },
        },
      },
    });
  }

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, returnPartialData: true })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: {
          __typename: "Person",
          name: "CACHED ALICE",
        },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "HELLO WORLD",
        recipient: {
          __typename: "Person",
          name: "CACHED ALICE",
        },
      },
    }),
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          recipient: {
            __typename: "Person",
            name: "Alice",
            email: "alice@example.com",
          },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "HELLO WORLD",
        recipient: {
          __typename: "Person",
          name: "ALICE",
          email: "ALICE@EXAMPLE.COM",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("applies field read functions with overlapping non-deferred and deferred fields while streaming", async () => {
  const query = gql`
    query {
      greeting {
        recipient {
          name
        }
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }
  `;

  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDeferStreamGraphQL17Alpha9();

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Person: {
          fields: {
            name: { read: uppercaseRead },
            email: { read: uppercaseRead },
          },
        },
      },
    }),
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: {
          __typename: "Person",
          name: "Alice",
        },
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        recipient: {
          __typename: "Person",
          name: "ALICE",
        },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          recipient: {
            __typename: "Person",
            name: "Alice",
            email: "alice@example.com",
          },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: {
          __typename: "Person",
          name: "ALICE",
          email: "ALICE@EXAMPLE.COM",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("applies field read functions when complete cache data inside a defer boundary fulfills the selection in intermediate chunks", async () => {
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
    mockDeferStreamGraphQL17Alpha9();
  const cache = new InMemoryCache({
    typePolicies: {
      Greeting: {
        fields: {
          message: { read: uppercaseRead },
        },
      },
      Person: {
        fields: {
          name: { read: uppercaseRead },
        },
      },
    },
  });

  {
    using _consoleSpy = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          recipient: {
            __typename: "Person",
            name: "Cached Alice",
          },
        },
      },
    });
  }

  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, returnPartialData: true })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: {
          __typename: "Person",
          name: "CACHED ALICE",
        },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  enqueueInitialChunk({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    },
    pending: [{ id: "0", path: ["greeting"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "HELLO WORLD",
        recipient: {
          __typename: "Person",
          name: "CACHED ALICE",
        },
      },
    }),
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: false,
  });

  enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          __typename: "Greeting",
          recipient: {
            __typename: "Person",
            name: "Alice",
          },
        },
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "HELLO WORLD",
        recipient: {
          __typename: "Person",
          name: "ALICE",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});
