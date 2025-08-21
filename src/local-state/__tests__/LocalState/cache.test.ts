import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  isReference,
} from "@apollo/client";
import { LocalState } from "@apollo/client/local-state";
import { spyOnConsole } from "@apollo/client/testing/internal";

import { gql } from "./testUtils.js";

test("can write to the cache with a mutation", async () => {
  const query = gql`
    {
      field
    }
  `;

  const mutation = gql`
    mutation start {
      start @client
    }
  `;

  const localState = new LocalState({
    resolvers: {
      Mutation: {
        start(_data, _args, { client }) {
          client.cache.writeQuery({ query, data: { field: 1 } });
          return true;
        },
      },
    },
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  await expect(
    localState.execute({
      document: mutation,
      client,
      context: {},
      variables: {},
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({ data: { start: true } });

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
      start @client
    }
  `;

  const localState = new LocalState({
    resolvers: {
      Mutation: {
        start(_, __, { client }) {
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

  await expect(
    localState.execute({
      document: mutation,
      client,
      context: {},
      variables: {},
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({ data: { start: true } });

  expect(client.readQuery({ query })).toStrictEqualTyped({
    obj: { __typename: "Object", field: 3 },
  });
});

test("does not overwrite __typename when writing to the cache with an id", async () => {
  const query = gql`
    {
      obj @client {
        field {
          field2
        }
        id
      }
    }
  `;

  const mutation = gql`
    mutation start {
      start @client
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      Mutation: {
        start(_, __, { client }) {
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

  await expect(
    localState.execute({
      document: mutation,
      client,
      context: {},
      variables: {},
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({ data: { start: true } });

  expect(client.readQuery({ query })).toStrictEqualTyped({
    obj: {
      __typename: "Object",
      field: { __typename: "Field", field2: 2 },
      id: "uniqueId",
    },
  });
});

test("reads from the cache on a root scalar field by default if a resolver is not defined", async () => {
  const document = gql`
    query {
      count @client
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeQuery({
    query: document,
    data: {
      count: 10,
    },
  });

  const localState = new LocalState();

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({ data: { count: 10 } });
});

test("reads from the cache on a root object field by default if a resolver is not defined", async () => {
  const document = gql`
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
    query: document,
    data: {
      user: {
        __typename: "User",
        id: 1,
        name: "Test User",
      },
    },
  });

  const localState = new LocalState();

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({
    data: { user: { __typename: "User", id: 1, name: "Test User" } },
  });
});

test("handles read functions for root scalar field from cache if resolver is not defined", async () => {
  const document = gql`
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

  const localState = new LocalState();

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({ data: { count: 10 } });
});

test("handles read functions for root object field from cache if resolver is not defined", async () => {
  const document = gql`
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

  const localState = new LocalState();

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({
    data: { user: { __typename: "User", id: 1, name: "Test User" } },
  });
});

test("does not warn if resolver is not defined if cache does not have value", async () => {
  using _ = spyOnConsole("warn");
  const document = gql`
    query {
      count @client
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState();

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({ data: { count: null } });

  expect(console.warn).not.toHaveBeenCalled();
});

test("reads from the cache on a nested scalar field by default if a resolver is not defined", async () => {
  const document = gql`
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

  client.writeQuery({
    query: document,
    data: {
      user: {
        __typename: "User",
        id: 1,
        isLoggedIn: true,
      },
    },
  });

  const localState = new LocalState();

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: { data: { user: { __typename: "User", id: 1 } } },
    })
  ).resolves.toStrictEqualTyped({
    data: { user: { __typename: "User", id: 1, isLoggedIn: true } },
  });
});

test("reads from the cache with a read function on a nested scalar field if a resolver is not defined", async () => {
  const document = gql`
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

  client.writeQuery({
    query: gql`
      query {
        user {
          id
        }
      }
    `,
    data: {
      user: {
        __typename: "User",
        id: 1,
      },
    },
  });

  const localState = new LocalState();

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: {
        data: { user: { __typename: "User", id: 1 } },
      },
    })
  ).resolves.toStrictEqualTyped({
    data: { user: { __typename: "User", id: 1, isLoggedIn: true } },
  });
});

test("reads from the cache on a nested object field by default if a resolver is not defined", async () => {
  const document = gql`
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

  client.writeQuery({
    query: document,
    data: {
      user: {
        __typename: "User",
        id: 1,
        bestFriend: {
          __typename: "User",
          id: 2,
          name: "Best Friend",
        },
      },
    },
  });

  const localState = new LocalState();

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: {
        data: { user: { __typename: "User", id: 1 } },
      },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      user: {
        __typename: "User",
        id: 1,
        bestFriend: { __typename: "User", id: 2, name: "Best Friend" },
      },
    },
  });
});

test("reads from the cache with a read function on a nested object field by default if a resolver is not defined", async () => {
  const document = gql`
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

  client.writeQuery({
    query: gql`
      query {
        user {
          id
        }
      }
    `,
    data: {
      user: {
        __typename: "User",
        id: 1,
      },
    },
  });

  const localState = new LocalState();

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: {
        data: { user: { __typename: "User", id: 1 } },
      },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      user: {
        __typename: "User",
        id: 1,
        bestFriend: { __typename: "User", id: 2, name: "Best Friend" },
      },
    },
  });
});

test("reads from the cache on a nested client field on a non-normalized object", async () => {
  const document = gql`
    query {
      user {
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

  client.writeQuery({
    query: gql`
      query {
        user {
          __typename
        }
      }
    `,
    data: {
      user: {
        __typename: "User",
      },
    },
  });

  const localState = new LocalState();

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: {
        data: { user: { __typename: "User" } },
      },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      user: {
        __typename: "User",
        bestFriend: { __typename: "User", id: 2, name: "Best Friend" },
      },
    },
  });
});

test("does not confuse field missing resolver with root field of same name on a normalized record", async () => {
  using _ = spyOnConsole("warn");
  const document = gql`
    query {
      count @client
      user {
        id
        count @client
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeQuery({
    query: gql`
      query {
        count
      }
    `,
    data: {
      count: 10,
    },
  });

  const localState = new LocalState();

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: {
        data: { user: { __typename: "User", id: 1 } },
      },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      count: 10,
      user: {
        __typename: "User",
        id: 1,
        count: null,
      },
    },
  });

  expect(console.warn).not.toHaveBeenCalled();
});

test("does not confuse field missing resolver with root field of same name on a non-normalized record", async () => {
  using _ = spyOnConsole("warn");
  const document = gql`
    query {
      count @client
      user {
        count @client
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeQuery({
    query: gql`
      query {
        count
      }
    `,
    data: {
      count: 10,
    },
  });

  const localState = new LocalState();

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: {
        data: { user: { __typename: "User" } },
      },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      count: 10,
      user: {
        __typename: "User",
        count: null,
      },
    },
  });

  expect(console.warn).not.toHaveBeenCalled();
});

test("warns on undefined value if partial data is written to the cache for an object client field", async () => {
  using _ = spyOnConsole("warn");
  const document = gql`
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

  client.writeQuery({
    query: gql`
      query {
        user {
          id
          bestFriend {
            id
          }
        }
      }
    `,
    data: {
      user: {
        __typename: "User",
        id: 1,
        bestFriend: { __typename: "User", id: 2 },
      },
    },
  });

  const localState = new LocalState();

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: {
        data: { user: { __typename: "User", id: 1 } },
      },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      user: {
        __typename: "User",
        id: 1,
        bestFriend: {
          __typename: "User",
          id: 2,
          name: null,
        },
      },
    },
  });

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "The '%s' field on object %o returned `undefined` instead of a value. The parent resolver did not include the property in the returned value and there was no resolver defined for the field.",
    "name",
    { __typename: "User", id: 2 }
  );
});

test("uses a written cache value from a nested client field from parent resolver", async () => {
  using _ = spyOnConsole("warn");

  const document = gql`
    {
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
    query: document,
    data: {
      user: {
        __typename: "User",
        id: 1,
        name: "Test User",
      },
    },
  });

  const localState = new LocalState({
    resolvers: {
      Query: {
        user: () => ({ __typename: "User", id: 1 }),
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({
    data: { user: { __typename: "User", id: 1, name: "Test User" } },
  });

  expect(console.warn).not.toHaveBeenCalled();
});
