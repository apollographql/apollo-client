import { ApolloClient, InMemoryCache } from "@apollo/client";
import { ApolloLink } from "@apollo/client/link";
import { LocalState } from "@apollo/client/local-state";
import { spyOnConsole } from "@apollo/client/testing/internal";
import { InvariantError } from "@apollo/client/utilities/invariant";

import { gql } from "./testUtils.js";

test("runs resolvers for @client queries", async () => {
  const document = gql`
    query Test {
      foo @client {
        bar
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo", bar: true }),
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
    data: { foo: { __typename: "Foo", bar: true } },
  });
});

test("can add resolvers after LocalState is instantiated", async () => {
  const document = gql`
    query Test {
      foo @client {
        bar
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState();

  localState.addResolvers({
    Query: {
      foo: () => ({ __typename: "Foo", bar: true }),
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
    data: { foo: { __typename: "Foo", bar: true } },
  });
});

test("handles queries with a mix of @client and server fields", async () => {
  const document = gql`
    query Mixed {
      foo @client {
        bar
      }
      bar {
        baz
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });
  const remoteResult = { data: { bar: { __typename: "Bar", baz: true } } };

  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo", bar: true }),
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult,
    })
  ).resolves.toStrictEqualTyped({
    data: {
      foo: { __typename: "Foo", bar: true },
      bar: { __typename: "Bar", baz: true },
    },
  });
});

test("runs resolvers for deeply nested @client fields", async () => {
  const document = gql`
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

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const remoteResult = {
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
  };

  const localState = new LocalState({
    resolvers: {
      User: {
        fullName: (user) => `${user.firstName} ${user.lastName}`,
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult,
    })
  ).resolves.toStrictEqualTyped({
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
});

test("has access to query variables in @client resolvers", async () => {
  const document = gql`
    query WithVariables($id: ID!) {
      foo @client {
        bar(fromVariable: $id)
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo" }),
      },
      Foo: {
        bar: (_, { fromVariable }) => fromVariable,
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: { id: 1 },
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({
    data: { foo: { __typename: "Foo", bar: 1 } },
  });
});

test("combines local @client resolver results with server results, for the same field", async () => {
  const document = gql`
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

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const remoteResult = {
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
  };

  const localState = new LocalState({
    resolvers: {
      Stats: {
        postsToday: () => 10,
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult,
    })
  ).resolves.toStrictEqualTyped({
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
});

test("handles resolvers that return booleans", async () => {
  const document = gql`
    query CartDetails {
      isInCart @client
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      Query: {
        isInCart: () => false,
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
    data: { isInCart: false },
  });
});

test("does not run resolvers without @client directive", async () => {
  const document = gql`
    query Mixed {
      foo @client {
        bar
      }
      bar {
        baz
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const remoteResult = { data: { bar: { __typename: "Bar", baz: true } } };

  const barResolver = jest.fn(() => ({ __typename: `Bar`, baz: false }));
  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => ({ __typename: `Foo`, bar: true }),
        bar: barResolver,
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult,
    })
  ).resolves.toStrictEqualTyped({
    data: {
      foo: { __typename: "Foo", bar: true },
      bar: { __typename: "Bar", baz: true },
    },
  });

  expect(barResolver).not.toHaveBeenCalled();
});

test("does not run resolvers without @client directive with nested field", async () => {
  const document = gql`
    query Mixed {
      foo {
        bar
        baz @client {
          qux
        }
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const remoteResult = { data: { foo: { __typename: "Foo", bar: true } } };

  const barResolver = jest.fn(() => true);
  const fooResolver = jest.fn(() => ({
    __typename: "Foo",
    bar: false,
  }));
  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: fooResolver,
      },
      Foo: {
        bar: barResolver,
        baz: () => ({ __typename: "Baz", qux: false }),
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult,
    })
  ).resolves.toStrictEqualTyped({
    data: {
      foo: {
        __typename: "Foo",
        bar: true,
        baz: { __typename: "Baz", qux: false },
      },
    },
  });

  expect(fooResolver).not.toHaveBeenCalled();
  expect(barResolver).not.toHaveBeenCalled();
});

test("allows child resolvers from a parent resolved field from a local resolver", async () => {
  const document = gql`
    query UserData {
      userData @client {
        firstName
        lastName
        fullName
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
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

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({
    data: {
      userData: {
        __typename: "User",
        firstName: "Ben",
        lastName: "Newman",
        fullName: "Ben Newman",
      },
    },
  });
});

test("can use remote result to resolve @client field", async () => {
  const document = gql`
    query Member {
      member {
        firstName
        lastName
        fullName @client
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const remoteResult = {
    data: {
      member: {
        __typename: "Member",
        firstName: "John",
        lastName: "Smithsonian",
      },
    },
  };

  const localState = new LocalState({
    resolvers: {
      Member: {
        fullName(member) {
          return `${member.firstName} ${member.lastName}`;
        },
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult,
    })
  ).resolves.toStrictEqualTyped({
    data: {
      member: {
        __typename: "Member",
        firstName: "John",
        lastName: "Smithsonian",
        fullName: "John Smithsonian",
      },
    },
  });
});

test("throws error when query does not contain client fields", async () => {
  const document = gql`
    query Member {
      member {
        firstName
        lastName
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const remoteResult = {
    data: {
      member: {
        __typename: "Member",
        firstName: "John",
        lastName: "Smithsonian",
      },
    },
  };

  const localState = new LocalState({
    resolvers: {},
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult,
    })
  ).rejects.toEqual(
    new InvariantError("Expected document to contain `@client` fields.")
  );
});

test("does not warn when a resolver is missing for an `@client` field", async () => {
  using _ = spyOnConsole("warn");
  const document = gql`
    query {
      foo @client
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
  ).resolves.toStrictEqualTyped({ data: { foo: null } });

  expect(console.warn).not.toHaveBeenCalled();
});

test("does not warn for client child fields of a server field", async () => {
  using _ = spyOnConsole("warn");
  const document = gql`
    query {
      foo {
        bar @client
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const remoteResult = { data: { foo: { __typename: "Foo" } } };
  const localState = new LocalState();

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult,
    })
  ).resolves.toStrictEqualTyped({
    data: { foo: { __typename: "Foo", bar: null } },
  });

  expect(console.warn).not.toHaveBeenCalled();
});

test("warns when a resolver returns undefined and sets value to null", async () => {
  using _ = spyOnConsole("warn");
  const document = gql`
    query {
      foo @client
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => {},
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
  ).resolves.toStrictEqualTyped({ data: { foo: null } });

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "The '%s' resolver returned `undefined` instead of a value. This is likely a bug in the resolver. If you didn't mean to return a value, return `null` instead.",
    "Query.foo"
  );
});

test("warns if a parent resolver omits a field with no child resolver", async () => {
  using _ = spyOnConsole("warn");
  const document = gql`
    query {
      foo @client {
        bar
        baz
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo", bar: true }),
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
    data: { foo: { __typename: "Foo", bar: true, baz: null } },
  });

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "The '%s' field on object %o returned `undefined` instead of a value. The parent resolver did not include the property in the returned value and there was no resolver defined for the field.",
    "baz",
    { __typename: "Foo", bar: true }
  );
});

test("warns if a parent resolver omits a field and child has @client field", async () => {
  using _ = spyOnConsole("warn");
  const document = gql`
    query {
      foo @client {
        bar
        baz @client
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo", bar: true }),
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
    data: { foo: { __typename: "Foo", bar: true, baz: null } },
  });

  // We don't want to see the missing resolver warning since the child field
  // should not be required to define a resolver since its a descendent of
  // another child field.
  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "The '%s' field on object %o returned `undefined` instead of a value. The parent resolver did not include the property in the returned value and there was no resolver defined for the field.",
    "baz",
    { __typename: "Foo", bar: true }
  );
});

test("adds an error when the __typename cannot be resolved", async () => {
  using _ = spyOnConsole("warn");
  const document = gql`
    query {
      foo @client {
        bar
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => ({ bar: true }),
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
    data: { foo: null },
    errors: [
      {
        message: `Could not resolve __typename on object ${JSON.stringify(
          { bar: true },
          null,
          2
        )} returned from resolver 'Query.foo'. '__typename' needs to be returned to properly resolve child fields.`,
        path: ["foo"],
        extensions: {
          localState: {
            resolver: "Query.foo",
          },
        },
      },
    ],
  });
});

test("can return more data than needed in resolver which is accessible by child resolver but omitted in output", async () => {
  const document = gql`
    query {
      foo @client {
        bar
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo", bar: true, random: true }),
      },
      Foo: {
        bar: (foo) => (foo.random ? "random" : "not random"),
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
    data: { foo: { __typename: "Foo", bar: "random" } },
  });
});

test("does not execute child resolver when parent is null", async () => {
  const document = gql`
    query {
      currentUser {
        id
        foo @client
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const foo = jest.fn(() => true);
  const remoteResult = { data: { currentUser: null } };
  const localState = new LocalState({
    resolvers: {
      User: {
        foo,
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult,
    })
  ).resolves.toStrictEqualTyped({
    data: { currentUser: null },
  });

  expect(foo).not.toHaveBeenCalled();
});

test("does not execute root scalar resolver data when remote data returns null", async () => {
  const document = gql`
    query {
      foo @client
      bar {
        id
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const remoteResult = {
    data: null,
    errors: [{ message: "Something went wrong" }],
  };

  let fooCount = 0;
  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => {
          fooCount++;
          return true;
        },
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult,
    })
  ).resolves.toStrictEqualTyped({
    data: null,
    errors: [{ message: "Something went wrong" }],
  });

  expect(fooCount).toBe(0);
});

test("does not run object resolver when remote data returns null", async () => {
  const document = gql`
    query {
      foo @client {
        baz
      }
      bar {
        id
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const remoteResult = {
    data: null,
    errors: [{ message: "Something went wrong" }],
  };

  let fooCount = 0;
  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => {
          fooCount++;
          return { __typename: "Foo", baz: true };
        },
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult,
    })
  ).resolves.toStrictEqualTyped({
    data: null,
    errors: [{ message: "Something went wrong" }],
  });

  expect(fooCount).toBe(0);
});

test("does not run root resolvers when multiple client fields are defined when remote data returns null", async () => {
  const document = gql`
    query {
      foo @client {
        baz
      }
      bar @client {
        baz
      }
      baz {
        id
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const remoteResult = {
    data: null,
    errors: [{ message: "Something went wrong" }],
  };

  let fooCount = 0;
  let barCount = 0;
  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => {
          fooCount++;
          return { __typename: "Foo", baz: true };
        },
        bar: () => {
          barCount++;
          return { __typename: "Bar", baz: false };
        },
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult,
    })
  ).resolves.toStrictEqualTyped({
    data: null,
    errors: [{ message: "Something went wrong" }],
  });

  expect(fooCount).toBe(0);
  expect(barCount).toBe(0);
});

test("does not execute resolver if client field is a child of a server field when data returns `null`", async () => {
  using _ = spyOnConsole("warn");
  const document = gql`
    query {
      baz {
        id
        foo @client
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const remoteResult = {
    data: null,
    errors: [{ message: "Something went wrong" }],
  };

  const foo = jest.fn(() => true);
  const localState = new LocalState({
    resolvers: {
      Baz: {
        foo,
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult,
    })
  ).resolves.toStrictEqualTyped({
    data: null,
    errors: [{ message: "Something went wrong" }],
  });

  expect(foo).not.toHaveBeenCalled();
  expect(console.warn).not.toHaveBeenCalled();
});
