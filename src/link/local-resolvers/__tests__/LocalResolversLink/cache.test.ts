import { of } from "rxjs";

import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  isReference,
} from "@apollo/client";
import { LocalResolversLink } from "@apollo/client/link/local-resolvers";
import {
  executeWithDefaultContext as execute,
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";

import { gql } from "./testUtils.js";

test("can write to the cache with a mutation", async () => {
  const query = gql`
    {
      field
    }
  `;

  const mutation = gql`
    mutation start {
      start @local
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Mutation: {
        start(_data, _args, { operation }) {
          operation.client.cache.writeQuery({ query, data: { field: 1 } });
          return true;
        },
      },
    },
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const stream = new ObservableStream(
    execute(link, { query: mutation }, { client })
  );

  await expect(stream).toEmitTypedValue({ data: { start: true } });
  await expect(stream).toComplete();

  expect(client.readQuery({ query })).toStrictEqualTyped({ field: 1 });
});

test("can write to the cache with a mutation using an ID", async () => {
  const query = gql`
    {
      obj {
        field
      }
    }
  `;

  const mutation = gql`
    mutation start {
      start @local
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Mutation: {
        start(_, __, { operation }) {
          const { client } = operation;
          client.writeQuery({
            query,
            data: {
              obj: { field: 1, id: "uniqueId", __typename: "Object" },
            },
          });

          client.cache.modify<{ id: string; field: number }>({
            id: "Object:uniqueId",
            fields: {
              field(value) {
                return value + 2;
              },
            },
          });

          return true;
        },
      },
    },
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });
  const stream = new ObservableStream(
    execute(link, { query: mutation }, { client })
  );

  await expect(stream).toEmitTypedValue({ data: { start: true } });

  expect(client.readQuery({ query })).toStrictEqualTyped({
    obj: { __typename: "Object", field: 3 },
  });
});

test("does not overwrite __typename when writing to the cache with an id", async () => {
  const query = gql`
    {
      obj @local {
        field {
          field2
        }
        id
      }
    }
  `;

  const mutation = gql`
    mutation start {
      start @local
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const link = new LocalResolversLink({
    resolvers: {
      Mutation: {
        start(_, __, { operation }) {
          const { client } = operation;

          client.writeQuery({
            query,
            data: {
              obj: {
                field: { field2: 1, __typename: "Field" },
                id: "uniqueId",
                __typename: "Object",
              },
            },
          });
          client.cache.modify<{ field: { field2: number } }>({
            id: "Object:uniqueId",
            fields: {
              field(value) {
                if (isReference(value)) {
                  fail("Should not be a reference");
                }
                expect(value.field2).toBe(1);
                return { ...value, field2: 2 };
              },
            },
          });
          return true;
        },
      },
    },
  });

  const stream = new ObservableStream(
    execute(link, { query: mutation }, { client })
  );

  await expect(stream).toEmitTypedValue({ data: { start: true } });
  await expect(stream).toComplete();

  expect(client.readQuery({ query })).toStrictEqualTyped({
    obj: {
      __typename: "Object",
      field: { __typename: "Field", field2: 2 },
      id: "uniqueId",
    },
  });
});

test("reads from the cache on a root scalar field by default if a resolver is not defined", async () => {
  const query = gql`
    query {
      count @client
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeQuery({
    query,
    data: {
      count: 10,
    },
  });

  const link = new LocalResolversLink();
  const stream = new ObservableStream(execute(link, { query }, { client }));

  await expect(stream).toEmitTypedValue({ data: { count: 10 } });
  await expect(stream).toComplete();
});

test("reads from the cache on a root object field by default if a resolver is not defined", async () => {
  const query = gql`
    query {
      user @client {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeQuery({
    query,
    data: {
      user: {
        __typename: "User",
        id: 1,
        name: "Test User",
      },
    },
  });

  const link = new LocalResolversLink();
  const stream = new ObservableStream(execute(link, { query }, { client }));

  await expect(stream).toEmitTypedValue({
    data: { user: { __typename: "User", id: 1, name: "Test User" } },
  });
  await expect(stream).toComplete();
});

test("handles read functions for root scalar field from cache if resolver is not defined", async () => {
  const query = gql`
    query {
      count @client
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            count: {
              read() {
                return 10;
              },
            },
          },
        },
      },
    }),
    link: ApolloLink.empty(),
  });

  const link = new LocalResolversLink();
  const stream = new ObservableStream(execute(link, { query }, { client }));

  await expect(stream).toEmitTypedValue({ data: { count: 10 } });
  await expect(stream).toComplete();
});

test("handles read functions for root object field from cache if resolver is not defined", async () => {
  const query = gql`
    query {
      user @client {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            user: {
              read() {
                return { __typename: "User", id: 1, name: "Test User" };
              },
            },
          },
        },
      },
    }),
    link: ApolloLink.empty(),
  });

  const link = new LocalResolversLink();
  const stream = new ObservableStream(execute(link, { query }, { client }));

  await expect(stream).toEmitTypedValue({
    data: { user: { __typename: "User", id: 1, name: "Test User" } },
  });
  await expect(stream).toComplete();
});

test("warns if resolver is not defined if cache does not have value", async () => {
  using _ = spyOnConsole("warn");
  const query = gql`
    query {
      count @client
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const link = new LocalResolversLink();
  const stream = new ObservableStream(execute(link, { query }, { client }));

  await expect(stream).toEmitTypedValue({ data: { count: null } });
  await expect(stream).toComplete();

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "Could not find a resolver for the '%s' field. The field value has been set to `null`.",
    "Query.count"
  );
});

test("reads from the cache on a nested scalar field by default if a resolver is not defined", async () => {
  const query = gql`
    query {
      user {
        id
        isLoggedIn @client
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment: gql`
      fragment LocalState on User {
        isLoggedIn
      }
    `,
    id: client.cache.identify({ __typename: "User", id: 1 }),
    data: {
      __typename: "User",
      isLoggedIn: true,
    },
  });

  const mockLink = new ApolloLink(() => {
    return of({ data: { user: { __typename: "User", id: 1 } } });
  });
  const localResolversLink = new LocalResolversLink();
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }, { client }));

  await expect(stream).toEmitTypedValue({
    data: { user: { __typename: "User", id: 1, isLoggedIn: true } },
  });
  await expect(stream).toComplete();
});

test("reads from the cache with a read function on a nested scalar field if a resolver is not defined", async () => {
  const query = gql`
    query {
      user {
        id
        isLoggedIn @client
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        User: {
          fields: {
            isLoggedIn: {
              read() {
                return true;
              },
            },
          },
        },
      },
    }),
    link: ApolloLink.empty(),
  });

  const mockLink = new ApolloLink(() => {
    return of({ data: { user: { __typename: "User", id: 1 } } });
  });
  const localResolversLink = new LocalResolversLink();
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }, { client }));

  await expect(stream).toEmitTypedValue({
    data: { user: { __typename: "User", id: 1, isLoggedIn: true } },
  });
  await expect(stream).toComplete();
});

test("reads from the cache on a nested object field by default if a resolver is not defined", async () => {
  const query = gql`
    query {
      user {
        id
        bestFriend @client {
          id
          name
        }
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment: gql`
      fragment LocalState on User {
        bestFriend {
          id
          name
        }
      }
    `,
    id: client.cache.identify({ __typename: "User", id: 1 }),
    data: {
      __typename: "User",
      bestFriend: {
        __typename: "User",
        id: 2,
        name: "Best Friend",
      },
    },
  });

  const mockLink = new ApolloLink(() => {
    return of({ data: { user: { __typename: "User", id: 1 } } });
  });
  const localResolversLink = new LocalResolversLink();
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }, { client }));

  await expect(stream).toEmitTypedValue({
    data: {
      user: {
        __typename: "User",
        id: 1,
        bestFriend: { __typename: "User", id: 2, name: "Best Friend" },
      },
    },
  });
  await expect(stream).toComplete();
});

test("reads from the cache with a read function on a nested object field by default if a resolver is not defined", async () => {
  const query = gql`
    query {
      user {
        id
        bestFriend @client {
          id
          name
        }
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        User: {
          fields: {
            bestFriend: {
              read() {
                return { __typename: "User", id: 2, name: "Best Friend" };
              },
            },
          },
        },
      },
    }),
    link: ApolloLink.empty(),
  });

  const mockLink = new ApolloLink(() => {
    return of({ data: { user: { __typename: "User", id: 1 } } });
  });
  const localResolversLink = new LocalResolversLink();
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }, { client }));

  await expect(stream).toEmitTypedValue({
    data: {
      user: {
        __typename: "User",
        id: 1,
        bestFriend: { __typename: "User", id: 2, name: "Best Friend" },
      },
    },
  });
  await expect(stream).toComplete();
});
