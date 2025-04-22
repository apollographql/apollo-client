import { of } from "rxjs";

import { ApolloLink } from "@apollo/client/link/core";
import { LocalResolversLink } from "@apollo/client/link/local-resolvers";
import { MockLink } from "@apollo/client/testing";
import {
  executeWithDefaultContext as execute,
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";

import { gql } from "./testUtils.js";

test("runs resolvers for @client queries", async () => {
  const query = gql`
    query Test {
      foo @client {
        bar
      }
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo", bar: true }),
      },
    },
  });

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: { foo: { __typename: "Foo", bar: true } },
  });

  await expect(stream).toComplete();
});

test("can add resolvers after the link is instantiated", async () => {
  const query = gql`
    query Test {
      foo @client {
        bar
      }
    }
  `;

  const link = new LocalResolversLink();

  link.addResolvers({
    Query: {
      foo: () => ({ __typename: "Foo", bar: true }),
    },
  });

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: { foo: { __typename: "Foo", bar: true } },
  });

  await expect(stream).toComplete();
});

test("handles queries with a mix of @client and server fields", async () => {
  const query = gql`
    query Mixed {
      foo @client {
        bar
      }
      bar {
        baz
      }
    }
  `;

  const serverQuery = gql`
    query Mixed {
      bar {
        baz
      }
    }
  `;

  const mockLink = new MockLink([
    {
      request: { query: serverQuery },
      result: { data: { bar: { __typename: "Bar", baz: true } } },
    },
  ]);

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo", bar: true }),
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      foo: { __typename: "Foo", bar: true },
      bar: { __typename: "Bar", baz: true },
    },
  });

  await expect(stream).toComplete();
});

test("runs resolvers for deeply nested @client fields", async () => {
  const query = gql`
    query Test {
      user {
        id
        bestFriend {
          firstName
          lastName
          fullName @client
        }
      }
    }
  `;

  const mockLink = new ApolloLink(() => {
    return of({
      data: {
        user: {
          __typename: "User",
          id: 1,
          bestFriend: {
            __typename: "User",
            firstName: "Test",
            lastName: "User",
          },
        },
      },
    });
  });

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      User: {
        fullName: (user) => `${user.firstName} ${user.lastName}`,
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      user: {
        __typename: "User",
        id: 1,
        bestFriend: {
          __typename: "User",
          firstName: "Test",
          lastName: "User",
          fullName: "Test User",
        },
      },
    },
  });

  await expect(stream).toComplete();
});

test("has access to query variables in @client resolvers", async () => {
  const query = gql`
    query WithVariables($id: ID!) {
      foo @client {
        bar(id: $id)
      }
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo" }),
      },
      Foo: {
        bar: (_: any, { id }: { id: number }) => id,
      },
    },
  });

  const stream = new ObservableStream(
    execute(link, { query, variables: { id: 1 } })
  );

  await expect(stream).toEmitTypedValue({
    data: { foo: { __typename: "Foo", bar: 1 } },
  });

  await expect(stream).toComplete();
});

test("passes context to @client resolvers", async () => {
  const query = gql`
    query WithContext {
      foo @client {
        bar
      }
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo" }),
      },
      Foo: {
        // @ts-expect-error FIXME before this is merged
        bar: (_data: any, _args: any, { id }: { id: number }) => id,
      },
    },
  });

  const stream = new ObservableStream(
    execute(link, { query, context: { id: 1 } })
  );

  await expect(stream).toEmitTypedValue({
    data: { foo: { __typename: "Foo", bar: 1 } },
  });

  await expect(stream).toComplete();
});

test("combines local @client resolver results with server results, for the same field", async () => {
  const query = gql`
    query author {
      author {
        name
        stats {
          totalPosts
          postsToday @client
        }
      }
    }
  `;

  const serverQuery = gql`
    query author {
      author {
        name
        stats {
          totalPosts
        }
      }
    }
  `;

  const mockLink = new MockLink([
    {
      request: { query: serverQuery },
      result: {
        data: {
          author: {
            name: "John Smith",
            stats: {
              totalPosts: 100,
              __typename: "Stats",
            },
            __typename: "Author",
          },
        },
      },
    },
  ]);

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Stats: {
        postsToday: () => 10,
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      author: {
        __typename: "Author",
        name: "John Smith",
        stats: {
          __typename: "Stats",
          totalPosts: 100,
          postsToday: 10,
        },
      },
    },
  });

  await expect(stream).toComplete();
});

test("handles resolvers that return booleans", async () => {
  const query = gql`
    query CartDetails {
      isInCart @client
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        isInCart: () => false,
      },
    },
  });

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({ data: { isInCart: false } });
  await expect(stream).toComplete();
});

test("does not run resolvers without @client directive", async () => {
  const query = gql`
    query Mixed {
      foo @client {
        bar
      }
      bar {
        baz
      }
    }
  `;

  const serverQuery = gql`
    query Mixed {
      bar {
        baz
      }
    }
  `;

  const mockLink = new MockLink([
    {
      request: { query: serverQuery },
      result: { data: { bar: { __typename: "Bar", baz: true } } },
    },
  ]);

  const barResolver = jest.fn(() => ({ __typename: `Bar`, baz: false }));
  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ __typename: `Foo`, bar: true }),
        bar: barResolver,
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      foo: { __typename: "Foo", bar: true },
      bar: { __typename: "Bar", baz: true },
    },
  });
  await expect(stream).toComplete();

  expect(barResolver).not.toHaveBeenCalled();
});

test("allows child resolvers from a parent resolved field from a local resolver", async () => {
  const query = gql`
    query UserData {
      userData @client {
        firstName
        lastName
        fullName
      }
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        userData() {
          return {
            __typename: "User",
            firstName: "Ben",
            lastName: "Newman",
          };
        },
      },
      User: {
        fullName(data) {
          return data.firstName + " " + data.lastName;
        },
      },
    },
  });

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      userData: {
        __typename: "User",
        firstName: "Ben",
        lastName: "Newman",
        fullName: "Ben Newman",
      },
    },
  });
  await expect(stream).toComplete();
});

test("can use remote result to resolve @client field", async () => {
  const query = gql`
    query Member {
      member {
        firstName
        lastName
        fullName @client
      }
    }
  `;

  const mockLink = new ApolloLink(() =>
    of({
      data: {
        member: {
          __typename: "Member",
          firstName: "John",
          lastName: "Smithsonian",
        },
      },
    })
  );

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Member: {
        fullName(member) {
          return `${member.firstName} ${member.lastName}`;
        },
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      member: {
        __typename: "Member",
        firstName: "John",
        lastName: "Smithsonian",
        fullName: "John Smithsonian",
      },
    },
  });
  await expect(stream).toComplete();
});

test("forwards query to terminating link if there are no client fields", async () => {
  const query = gql`
    query Member {
      member {
        firstName
        lastName
      }
    }
  `;

  const mockLink = new ApolloLink(() =>
    of({
      data: {
        member: {
          __typename: "Member",
          firstName: "John",
          lastName: "Smithsonian",
        },
      },
    })
  );

  const localResolversLink = new LocalResolversLink({
    resolvers: {},
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      member: {
        __typename: "Member",
        firstName: "John",
        lastName: "Smithsonian",
      },
    },
  });
  await expect(stream).toComplete();
});

test("warns when a resolver is missing for an `@client` field", async () => {
  using _ = spyOnConsole("warn");
  const query = gql`
    query {
      foo @client
    }
  `;

  const link = new LocalResolversLink();

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({ data: { foo: null } });
  await expect(stream).toComplete();

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "The '%s' type is missing a resolver for the '%s' field",
    "Query",
    "foo"
  );
});

test.failing(
  "adds an error when the __typename cannot be resolved",
  async () => {
    using _ = spyOnConsole("warn");
    const query = gql`
      query {
        foo @client {
          bar
        }
      }
    `;

    const link = new LocalResolversLink({
      resolvers: {
        Query: {
          foo: () => ({ bar: true }),
        },
      },
    });

    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitTypedValue({
      data: { foo: null },
      errors: [
        {
          message: `Could not resolve __typename from object ${JSON.stringify(
            { bar: true },
            null,
            2
          )}. This is an error and can cause issues when writing to the cache.`,
        },
      ],
    });
    await expect(stream).toComplete();
  }
);
