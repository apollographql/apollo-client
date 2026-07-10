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
  spyOnConsole,
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
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
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
      { id: "0", path: ["greeting"] },
      { id: "1", path: ["greeting"] },
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
      { id: "0", path: ["greeting"] },
      { id: "1", path: ["greeting"] },
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
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    }),
    // `email` is excluded by `@skip`, so the deferred fragment is fully
    // satisfied by the cached `name` and should report complete while streaming.
    dataState: "complete",
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
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
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
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
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
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
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
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "cached@example.com",
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
    data: markAsStreaming({
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

test('reports "streaming" when two `@defer` fragments overlap and only the second fragment\'s exclusive fields are missing', async () => {
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
      { id: "0", path: ["greeting"] },
      { id: "1", path: ["greeting"] },
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
    data: markAsStreaming({
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
        recipient: { __typename: "Person" },
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
        recipient: { __typename: "Person" },
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
