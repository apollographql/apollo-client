import { from } from "rxjs";

import {
  ApolloClient,
  ApolloLink,
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
  spyOnConsole,
} from "@apollo/client/testing/internal";
import { hasDirectives } from "@apollo/client/utilities/internal";

// Note: these tests will temporarily live in this file until they are pulled
// into https://github.com/apollographql/apollo-client/pull/13324. I wanted a
// separate test suite that avoids conflicts with the other changes so that I
// can easily copy these over once pulled into that branch. #13324 should fix
// many if not all of these.

function uppercaseRead(existing: unknown) {
  return typeof existing === "string" ? existing.toUpperCase() : existing;
}

function createStreamLink(rootValue?: Record<string, unknown>) {
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

type Friend = { id: number; name: string };

test.failing(
  "applies field read functions to non-deferred fields while streaming deferred results",
  async () => {
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
  }
);

test.failing(
  "applies field read functions to partial non-deferred cached data before and after deferred network results",
  async () => {
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
  }
);

test.failing(
  "applies field read functions when partial cache data in a defer boundary is merged with streaming results",
  async () => {
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
  }
);

test.failing(
  "applies field read functions with overlapping non-deferred and deferred fields while streaming",
  async () => {
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
  }
);

test("applies field read functions when residual complete deferred cache data fills the selection set mid-stream", async () => {
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

test("applies field read functions to streamed list items on intermediate and final results", async () => {
  const { subject, stream: iterableStream } = asyncIterableSubject<Friend>();

  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Friend: {
          fields: {
            name: { read: uppercaseRead },
          },
        },
      },
    }),
    link: createStreamLink({ friendList: async () => iterableStream }),
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

  subject.next({ name: "Luke", id: 1 });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [{ __typename: "Friend", id: "1", name: "LUKE" }],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  subject.next({ name: "Han", id: 2 });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "LUKE" },
        { __typename: "Friend", id: "2", name: "HAN" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  subject.next({ name: "Leia", id: 3 });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "LUKE" },
        { __typename: "Friend", id: "2", name: "HAN" },
        { __typename: "Friend", id: "3", name: "LEIA" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  subject.complete();

  await expect(stream).toEmitTypedValue({
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "LUKE" },
        { __typename: "Friend", id: "2", name: "HAN" },
        { __typename: "Friend", id: "3", name: "LEIA" },
      ],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test.failing(
  "applies field read functions to partial cached stream list data before and during streaming",
  async () => {
    const { subject, stream: iterableStream } = asyncIterableSubject<Friend>();

    const query = gql`
      query {
        friendList @stream(initialCount: 1) {
          id
          name
        }
      }
    `;

    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            friendList: {
              merge(existing = [], incoming, { field }) {
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
        Friend: {
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
          friendList: [
            { __typename: "Friend", id: "1", name: "Cached Luke" },
            { __typename: "Friend", id: "2" },
            { __typename: "Friend", id: "3" },
          ],
        },
      });
    }

    const client = new ApolloClient({
      cache,
      link: createStreamLink({ friendList: async () => iterableStream }),
      incrementalHandler: new GraphQL17Alpha9Handler(),
    });

    const stream = new ObservableStream(
      client.watchQuery({ query, returnPartialData: true })
    );

    await expect(stream).toEmitTypedValue({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "CACHED LUKE" },
          { __typename: "Friend", id: "2" },
          { __typename: "Friend", id: "3" },
        ],
      },
      dataState: "partial",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    subject.next({ name: "Luke", id: 1 });

    await expect(stream).toEmitTypedValue({
      data: markAsStreaming({
        friendList: [
          { __typename: "Friend", id: "1", name: "LUKE" },
          { __typename: "Friend", id: "2" },
          { __typename: "Friend", id: "3" },
        ],
      }),
      dataState: "streaming",
      loading: true,
      networkStatus: NetworkStatus.streaming,
      partial: true,
    });

    subject.next({ name: "Han", id: 2 });

    await expect(stream).toEmitTypedValue({
      data: markAsStreaming({
        friendList: [
          { __typename: "Friend", id: "1", name: "LUKE" },
          { __typename: "Friend", id: "2", name: "HAN" },
          { __typename: "Friend", id: "3" },
        ],
      }),
      dataState: "streaming",
      loading: true,
      networkStatus: NetworkStatus.streaming,
      partial: true,
    });

    subject.next({ name: "Leia", id: 3 });

    await expect(stream).toEmitTypedValue({
      data: markAsStreaming({
        friendList: [
          { __typename: "Friend", id: "1", name: "LUKE" },
          { __typename: "Friend", id: "2", name: "HAN" },
          { __typename: "Friend", id: "3", name: "LEIA" },
        ],
      }),
      dataState: "streaming",
      loading: true,
      networkStatus: NetworkStatus.streaming,
      partial: true,
    });

    subject.complete();

    await expect(stream).toEmitTypedValue({
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "LUKE" },
          { __typename: "Friend", id: "2", name: "HAN" },
          { __typename: "Friend", id: "3", name: "LEIA" },
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

test("applies field read functions to residual complete stream list items while later items are still streaming", async () => {
  const { subject, stream: iterableStream } = asyncIterableSubject<Friend>();

  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const cache = new InMemoryCache({
    typePolicies: {
      Friend: {
        fields: {
          name: { read: uppercaseRead },
        },
      },
    },
  });

  cache.writeQuery({
    query,
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Cached Luke" },
        { __typename: "Friend", id: "2", name: "Cached Han" },
        { __typename: "Friend", id: "3", name: "Cached Leia" },
      ],
    },
  });

  const client = new ApolloClient({
    cache,
    link: createStreamLink({ friendList: async () => iterableStream }),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "cache-and-network" })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "CACHED LUKE" },
        { __typename: "Friend", id: "2", name: "CACHED HAN" },
        { __typename: "Friend", id: "3", name: "CACHED LEIA" },
      ],
    },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: false,
  });

  subject.next({ name: "Luke", id: 1 });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "LUKE" },
        { __typename: "Friend", id: "2", name: "CACHED HAN" },
        { __typename: "Friend", id: "3", name: "CACHED LEIA" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  subject.next({ name: "Han", id: 2 });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "LUKE" },
        { __typename: "Friend", id: "2", name: "HAN" },
        { __typename: "Friend", id: "3", name: "CACHED LEIA" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  subject.next({ name: "Leia", id: 3 });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "LUKE" },
        { __typename: "Friend", id: "2", name: "HAN" },
        { __typename: "Friend", id: "3", name: "LEIA" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  subject.complete();

  await expect(stream).toEmitTypedValue({
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "LUKE" },
        { __typename: "Friend", id: "2", name: "HAN" },
        { __typename: "Friend", id: "3", name: "LEIA" },
      ],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("applies field read functions when @stream delivers nested objects with overlapping non-stream fields", async () => {
  const query = gql`
    query {
      book {
        title
        author {
          name
        }
        reviews @stream(initialCount: 0) {
          id
          body
          author {
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
        Book: {
          fields: {
            title: { read: uppercaseRead },
          },
        },
        Person: {
          fields: {
            name: { read: uppercaseRead },
          },
        },
        Review: {
          fields: {
            body: {
              read: uppercaseRead,
            },
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
      book: {
        __typename: "Book",
        title: "The Information",
        author: {
          __typename: "Person",
          name: "James Gleick",
        },
        reviews: [],
      },
    },
    pending: [{ id: "0", path: ["book", "reviews"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      book: {
        __typename: "Book",
        title: "THE INFORMATION",
        author: {
          __typename: "Person",
          name: "JAMES GLEICK",
        },
        reviews: [],
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
        items: [
          {
            __typename: "Review",
            id: "1",
            body: "Great book",
            author: {
              __typename: "Person",
              name: "Ada",
            },
          },
        ] as any,
        id: "0",
      },
    ],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: markAsStreaming({
      book: {
        __typename: "Book",
        title: "THE INFORMATION",
        author: {
          __typename: "Person",
          name: "JAMES GLEICK",
        },
        reviews: [
          {
            __typename: "Review",
            id: "1",
            body: "GREAT BOOK",
            author: {
              __typename: "Person",
              name: "ADA",
            },
          },
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
        items: [
          {
            __typename: "Review",
            id: "2",
            body: "Still great",
            author: {
              __typename: "Person",
              name: "Grace",
            },
          },
        ] as any,
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      book: {
        __typename: "Book",
        title: "THE INFORMATION",
        author: {
          __typename: "Person",
          name: "JAMES GLEICK",
        },
        reviews: [
          {
            __typename: "Review",
            id: "1",
            body: "GREAT BOOK",
            author: {
              __typename: "Person",
              name: "ADA",
            },
          },
          {
            __typename: "Review",
            id: "2",
            body: "STILL GREAT",
            author: {
              __typename: "Person",
              name: "GRACE",
            },
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
