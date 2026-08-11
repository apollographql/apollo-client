import { ApolloClient, gql, InMemoryCache } from "@apollo/client";
import { Defer20220824Handler } from "@apollo/client/incremental";
import { MockLink } from "@apollo/client/testing";
import {
  mockDefer20220824,
  ObservableStream,
  spyOnConsole,
  wait,
} from "@apollo/client/testing/internal";
import { offsetLimitPagination } from "@apollo/client/utilities";

test("warns when a written network result reads back from the cache as partial", async () => {
  using _ = spyOnConsole("warn");

  const query = gql`
    query UserQuery {
      user {
        name
        age
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            user: {
              merge: (_, incoming) => ({
                __typename: incoming.__typename,
                name: incoming.name,
              }),
            },
          },
        },
      },
    }),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: { user: { __typename: "User", name: "Alice", age: 30 } },
        },
      },
    ]),
  });

  await client.query({ query });

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining("partial result"),
    "UserQuery",
    { user: { age: expect.stringContaining("Can't find field 'age'") } },
    { user: { __typename: "User", name: "Alice", age: 30 } },
    { user: { __typename: "User", name: "Alice" } }
  );
});

test("warns for a watched query when the cache read is partial after the write", async () => {
  using _ = spyOnConsole("warn");

  const query = gql`
    query UserQuery {
      user {
        name
        age
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            user: {
              merge: (_, incoming) => ({
                __typename: incoming.__typename,
                name: incoming.name,
              }),
            },
          },
        },
      },
    }),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: { user: { __typename: "User", name: "Alice", age: 30 } },
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
  });

  using stream = new ObservableStream(client.watchQuery({ query }));

  // loading
  await stream.takeNext();
  // result
  await stream.takeNext();

  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining("partial result"),
    "UserQuery",
    { user: { age: expect.stringContaining("Can't find field 'age'") } },
    { user: { __typename: "User", name: "Alice", age: 30 } },
    { user: { __typename: "User", name: "Alice" } }
  );
});

test("warns when a `read` function makes the cache result partial", async () => {
  using _ = spyOnConsole("warn");

  const query = gql`
    query UserQuery {
      user {
        name
        age
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        User: { fields: { age: { read: () => undefined } } },
      },
    }),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: { user: { __typename: "User", name: "Alice", age: 30 } },
        },
      },
    ]),
  });

  await client.query({ query });

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining("partial result"),
    "UserQuery",
    { user: { age: expect.any(String) } },
    { user: { __typename: "User", name: "Alice", age: 30 } },
    { user: { __typename: "User", name: "Alice" } }
  );
});

test("does not warn when the cache read is complete", async () => {
  using _ = spyOnConsole("warn");

  const query = gql`
    query UserQuery {
      user {
        name
        age
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: { user: { __typename: "User", name: "Alice", age: 30 } },
        },
      },
    ]),
  });

  await client.query({ query });

  expect(console.warn).not.toHaveBeenCalled();
});

test("does not warn for an anonymous query when the cache read is complete", async () => {
  using _ = spyOnConsole("warn");

  const query = gql`
    {
      user {
        name
        age
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: { user: { __typename: "User", name: "Alice", age: 30 } },
        },
      },
    ]),
  });

  await client.query({ query });

  expect(console.warn).not.toHaveBeenCalled();
});

test("names an anonymous query as `(anonymous)` in the warning", async () => {
  using _ = spyOnConsole("warn");

  const query = gql`
    {
      user {
        name
        age
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            user: {
              merge: (_, incoming) => ({
                __typename: incoming.__typename,
                name: incoming.name,
              }),
            },
          },
        },
      },
    }),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: { user: { __typename: "User", name: "Alice", age: 30 } },
        },
      },
    ]),
  });

  await client.query({ query });

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining("partial result"),
    "(anonymous)",
    expect.anything(),
    expect.anything(),
    expect.anything()
  );
});

test("does not warn with `fetchPolicy: 'no-cache'`", async () => {
  using _ = spyOnConsole("warn");

  const query = gql`
    query UserQuery {
      user {
        name
        age
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            user: {
              merge: (_, incoming) => ({
                __typename: incoming.__typename,
                name: incoming.name,
              }),
            },
          },
        },
      },
    }),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: { user: { __typename: "User", name: "Alice", age: 30 } },
        },
      },
    ]),
  });

  await client.query({ query, fetchPolicy: "no-cache" });

  expect(console.warn).not.toHaveBeenCalled();
});

test("does not warn when the result is not written because of GraphQL errors", async () => {
  using _ = spyOnConsole("warn");

  const query = gql`
    query UserQuery {
      user {
        name
        age
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            user: {
              merge: (_, incoming) => ({
                __typename: incoming.__typename,
                name: incoming.name,
              }),
            },
          },
        },
      },
    }),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: { user: { __typename: "User", name: "Alice", age: 30 } },
          errors: [{ message: "Oops" }],
        },
      },
    ]),
  });

  await expect(client.query({ query, errorPolicy: "none" })).rejects.toThrow();

  expect(console.warn).not.toHaveBeenCalled();
});

test("does not warn while a deferred result is still streaming", async () => {
  using _ = spyOnConsole("warn");

  const query = gql`
    query DeferredQuery {
      person(id: 1) {
        id
        name
        ... @defer {
          homeworld
        }
      }
    }
  `;

  const defer = mockDefer20220824();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: defer.httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });

  using stream = new ObservableStream(client.watchQuery({ query }));

  await stream.takeNext();

  defer.enqueueInitialChunk({
    data: { person: { __typename: "Person", id: "1", name: "Luke" } },
    hasNext: true,
  });

  await stream.takeNext();

  expect(console.warn).not.toHaveBeenCalled();

  defer.enqueueSubsequentChunk({
    incremental: [{ path: ["person"], data: { homeworld: "Tatooine" } }],
    hasNext: false,
  });

  await stream.takeNext();

  expect(console.warn).not.toHaveBeenCalled();
});

test("does not warn again when the cache write is skipped because the identical result was already written", async () => {
  using _ = spyOnConsole("warn");

  const query = gql`
    query UserQuery {
      user {
        name
        age
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            user: {
              merge: (_, incoming) => ({
                __typename: incoming.__typename,
                name: incoming.name,
              }),
            },
          },
        },
      },
    }),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: { user: { __typename: "User", name: "Alice", age: 30 } },
        },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
  });

  const observable = client.watchQuery({ query });
  using stream = new ObservableStream(observable);

  // loading
  await stream.takeNext();
  // result
  await stream.takeNext();

  expect(console.warn).toHaveBeenCalledTimes(1);

  client.writeQuery({
    query: gql`
      query {
        user {
          name
        }
      }
    `,
    data: { user: { __typename: "User", name: "Alice (updated)" } },
  });

  // loading
  await stream.takeNext();
  // result
  await stream.takeNext();

  expect(console.warn).toHaveBeenCalledTimes(1);
});

// https://github.com/apollographql/apollo-client/issues/9293
test("warns when a pagination `merge` function concatenates a partial item into the list", async () => {
  // The `cache.writeQuery` below writes a `Person` without `createdAt`, which
  // logs a "Missing field" error we are not interested in here.
  using _ = spyOnConsole("warn", "error");

  const query = gql`
    query PeopleQuery {
      people {
        id
        name
        createdAt
      }
    }
  `;

  const mutation = gql`
    mutation AddPerson($name: String!) {
      addPerson(name: $name) {
        id
        name
      }
    }
  `;

  const people = [
    {
      __typename: "Person",
      id: "1",
      name: "John Smith",
      createdAt: "2020-01-01",
    },
    {
      __typename: "Person",
      id: "2",
      name: "Sara Smith",
      createdAt: "2020-01-02",
    },
  ];

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: { fields: { people: offsetLimitPagination() } },
      },
    }),
    link: new MockLink([
      {
        request: { query },
        result: { data: { people } },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
      {
        request: { query: mutation, variables: { name: "Budd Deey" } },
        result: {
          data: {
            addPerson: { __typename: "Person", id: "3", name: "Budd Deey" },
          },
        },
      },
    ]),
  });

  const observable = client.watchQuery({ query });
  using stream = new ObservableStream(observable);

  await stream.takeNext();
  await stream.takeNext();

  expect(console.warn).not.toHaveBeenCalled();

  await client.mutate({
    mutation,
    variables: { name: "Budd Deey" },
    update: (cache, { data }) => {
      cache.writeQuery({
        query,
        data: { people: [(data as any).addPerson] },
      });
    },
  });

  await observable.refetch();
  await wait(50);

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining("partial result"),
    "PeopleQuery",
    {
      people: {
        2: {
          createdAt: expect.stringContaining("Can't find field 'createdAt'"),
        },
      },
    },
    // The network result Apollo Client hands to the application, which holds
    // the raw `createdAt` strings instead of anything a `read` function or a
    // custom scalar would have parsed.
    { people },
    {
      people: [
        ...people,
        { __typename: "Person", id: "3", name: "Budd Deey" },
        ...people,
      ],
    }
  );
});
