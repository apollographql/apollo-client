import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import React from "react";

import {
  ApolloClient,
  CombinedGraphQLErrors,
  gql,
  InMemoryCache,
  NetworkStatus,
} from "@apollo/client";
import { Defer20220824Handler } from "@apollo/client/incremental";
import { ApolloProvider, useQuery } from "@apollo/client/react";
import { MockSubscriptionLink } from "@apollo/client/testing";
import { markAsStreaming, spyOnConsole } from "@apollo/client/testing/internal";

test("should handle deferred queries", async () => {
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

  const link = new MockSubscriptionLink();

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  setTimeout(() => {
    link.simulateResult({
      result: {
        data: {
          greeting: {
            message: "Hello world",
            __typename: "Greeting",
          },
        },
        hasNext: true,
      },
    });
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      greeting: {
        message: "Hello world",
        __typename: "Greeting",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: undefined,
    variables: {},
  });

  setTimeout(() => {
    link.simulateResult(
      {
        result: {
          incremental: [
            {
              data: {
                recipient: {
                  name: "Alice",
                  __typename: "Person",
                },
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
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      greeting: {
        message: "Hello world",
        __typename: "Greeting",
        recipient: {
          name: "Alice",
          __typename: "Person",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: {
      greeting: {
        message: "Hello world",
        __typename: "Greeting",
      },
    },
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});

test("should handle deferred queries in lists", async () => {
  const query = gql`
    {
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

  const link = new MockSubscriptionLink();

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  setTimeout(() => {
    link.simulateResult({
      result: {
        data: {
          greetings: [
            { message: "Hello world", __typename: "Greeting" },
            { message: "Hello again", __typename: "Greeting" },
          ],
        },
        hasNext: true,
      },
    });
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      greetings: [
        { message: "Hello world", __typename: "Greeting" },
        { message: "Hello again", __typename: "Greeting" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: undefined,
    variables: {},
  });

  setTimeout(() => {
    link.simulateResult({
      result: {
        incremental: [
          {
            data: {
              recipient: {
                name: "Alice",
                __typename: "Person",
              },
              __typename: "Greeting",
            },
            path: ["greetings", 0],
          },
        ],
        hasNext: true,
      },
    });
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      greetings: [
        {
          message: "Hello world",
          __typename: "Greeting",
          recipient: { name: "Alice", __typename: "Person" },
        },
        { message: "Hello again", __typename: "Greeting" },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: {
      greetings: [
        { message: "Hello world", __typename: "Greeting" },
        { message: "Hello again", __typename: "Greeting" },
      ],
    },
    variables: {},
  });

  setTimeout(() => {
    link.simulateResult(
      {
        result: {
          incremental: [
            {
              data: {
                recipient: {
                  name: "Bob",
                  __typename: "Person",
                },
                __typename: "Greeting",
              },
              path: ["greetings", 1],
            },
          ],
          hasNext: false,
        },
      },
      true
    );
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      greetings: [
        {
          message: "Hello world",
          __typename: "Greeting",
          recipient: { name: "Alice", __typename: "Person" },
        },
        {
          message: "Hello again",
          __typename: "Greeting",
          recipient: { name: "Bob", __typename: "Person" },
        },
      ],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: {
      greetings: [
        {
          message: "Hello world",
          __typename: "Greeting",
          recipient: { name: "Alice", __typename: "Person" },
        },
        { message: "Hello again", __typename: "Greeting" },
      ],
    },
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});

test("should handle deferred queries in lists, merging arrays", async () => {
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

  const link = new MockSubscriptionLink();

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  setTimeout(() => {
    link.simulateResult({
      result: {
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
      },
    });
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
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
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: undefined,
    variables: {},
  });

  setTimeout(() => {
    link.simulateResult({
      result: {
        hasNext: true,
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
      },
    });
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
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
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: {
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
    variables: {},
  });
});

test("should handle deferred queries with fetch policy no-cache", async () => {
  const query = gql`
    {
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

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { fetchPolicy: "no-cache" }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  setTimeout(() => {
    link.simulateResult({
      result: {
        data: {
          greeting: {
            message: "Hello world",
            __typename: "Greeting",
          },
        },
        hasNext: true,
      },
    });
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      greeting: {
        message: "Hello world",
        __typename: "Greeting",
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: undefined,
    variables: {},
  });

  setTimeout(() => {
    link.simulateResult(
      {
        result: {
          incremental: [
            {
              data: {
                recipient: {
                  name: "Alice",
                  __typename: "Person",
                },
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
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      greeting: {
        message: "Hello world",
        __typename: "Greeting",
        recipient: {
          name: "Alice",
          __typename: "Person",
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: {
      greeting: {
        message: "Hello world",
        __typename: "Greeting",
      },
    },
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});

test("should handle deferred queries with errors returned on the incremental batched result", async () => {
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

  const link = new MockSubscriptionLink();

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  setTimeout(() => {
    link.simulateResult({
      result: {
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
      },
    });
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
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
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: undefined,
    variables: {},
  });

  setTimeout(() => {
    link.simulateResult(
      {
        result: {
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
        },
      },
      true
    );
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
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
    },
    dataState: "complete",
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
          message: "homeWorld for character with ID 1000 could not be fetched.",
          path: ["hero", "heroFriends", 0, "homeWorld"],
        },
      ],
    }),
    loading: false,
    networkStatus: NetworkStatus.error,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});

it('should handle deferred queries with errors returned on the incremental batched result and errorPolicy "all"', async () => {
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

  const link = new MockSubscriptionLink();

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { errorPolicy: "all" }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  setTimeout(() => {
    link.simulateResult({
      result: {
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
      },
    });
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
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
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: undefined,
    variables: {},
  });

  setTimeout(() => {
    link.simulateResult(
      {
        result: {
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
              extensions: {
                thing1: "foo",
                thing2: "bar",
              },
            },
            {
              path: ["hero", "heroFriends", 1],
              data: {
                homeWorld: "Alderaan",
              },
              extensions: {
                thing1: "foo",
                thing2: "bar",
              },
            },
          ],
          hasNext: false,
        },
      },
      true
    );
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      hero: {
        heroFriends: [
          {
            // the only difference with the previous test
            // is that homeWorld is populated since errorPolicy: all
            // populates both partial data and error.graphQLErrors
            homeWorld: null,
            id: "1000",
            name: "Luke Skywalker",
          },
          {
            // homeWorld is populated due to errorPolicy: all
            homeWorld: "Alderaan",
            id: "1003",
            name: "Leia Organa",
          },
        ],
        name: "R2-D2",
      },
    },
    dataState: "complete",
    error: new CombinedGraphQLErrors({
      data: {
        hero: {
          heroFriends: [
            { homeWorld: null, id: "1000", name: "Luke Skywalker" },
            { homeWorld: "Alderaan", id: "1003", name: "Leia Organa" },
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
      extensions: {
        thing1: "foo",
        thing2: "bar",
      },
    }),
    loading: false,
    networkStatus: NetworkStatus.error,
    previousData: {
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
    },
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});

it('returns eventually consistent data from deferred queries with data in the cache while using a "cache-and-network" fetch policy', async () => {
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

  const link = new MockSubscriptionLink();
  const cache = new InMemoryCache();
  const client = new ApolloClient({
    cache,
    link,
    incrementalHandler: new Defer20220824Handler(),
  });

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

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { fetchPolicy: "cache-and-network" }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello cached",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  link.simulateResult({
    result: {
      data: {
        greeting: { __typename: "Greeting", message: "Hello world" },
      },
      hasNext: true,
    },
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: {
      greeting: {
        __typename: "Greeting",
        message: "Hello cached",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    variables: {},
  });

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

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
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
    previousData: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});

it('returns eventually consistent data from deferred queries with partial data in the cache and using a "cache-first" fetch policy with `returnPartialData`', async () => {
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
  const link = new MockSubscriptionLink();
  const client = new ApolloClient({
    cache,
    link,
    incrementalHandler: new Defer20220824Handler(),
  });

  // We know we are writing partial data to the cache so suppress the console
  // warning.
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

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useQuery(query, {
        fetchPolicy: "cache-first",
        returnPartialData: true,
      }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    dataState: "partial",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  link.simulateResult({
    result: {
      data: {
        greeting: { message: "Hello world", __typename: "Greeting" },
      },
      hasNext: true,
    },
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: {
      greeting: {
        __typename: "Greeting",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    variables: {},
  });

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

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
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
    previousData: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});
