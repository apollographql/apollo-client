import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  LocalStateError,
} from "@apollo/client";
import { LocalState } from "@apollo/client/local-state";

import { gql } from "./testUtils.js";

test("resolves @client fields mixed with aliased server fields", async () => {
  const document = gql`
    query Aliased {
      foo @client {
        bar
      }
      baz: bar {
        foo
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const remoteResult = {
    data: {
      baz: { foo: true, __typename: "Bar" },
    },
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => ({ bar: true, __typename: "Foo" }),
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      remoteResult,
      variables: {},
    })
  ).resolves.toStrictEqualTyped({
    data: {
      foo: { bar: true, __typename: "Foo" },
      baz: { foo: true, __typename: "Bar" },
    },
  });
});

test("resolves aliased @client fields", async () => {
  const document = gql`
    query Test {
      fie: foo @client {
        bar
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const fie = jest.fn();
  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => ({ bar: true, __typename: "Foo" }),
        fie,
      },
    },
  });

  await expect(
    localState.execute({
      client,
      document,
      context: {},
      variables: {},
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({
    data: { fie: { bar: true, __typename: "Foo" } },
  });

  expect(fie).not.toHaveBeenCalled();
});

test("resolves deeply nested aliased @client fields", async () => {
  const document = gql`
    query Test {
      user {
        id
        bestFriend {
          first: firstName
          last: lastName
          name: fullName @client
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
          first: "Test",
          last: "User",
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
      client,
      document,
      context: {},
      remoteResult,
      variables: {},
    })
  ).resolves.toStrictEqualTyped({
    data: {
      user: {
        __typename: "User",
        id: 1,
        bestFriend: {
          __typename: "User",
          first: "Test",
          last: "User",
          name: "Test User",
        },
      },
    },
  });
});

test("respects aliases for *nested fields* on the @client-tagged node", async () => {
  const document = gql`
    query Test {
      fie: foo @client {
        fum: bar
      }
      baz: bar {
        foo
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const remoteResult = { data: { baz: { foo: true, __typename: "Baz" } } };

  const fie = jest.fn();
  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => ({ bar: true, __typename: "Foo" }),
        fie,
      },
    },
  });

  await expect(
    localState.execute({
      client,
      document,
      context: {},
      remoteResult,
      variables: {},
    })
  ).resolves.toStrictEqualTyped({
    data: {
      fie: { fum: true, __typename: "Foo" },
      baz: { foo: true, __typename: "Baz" },
    },
  });

  expect(fie).not.toHaveBeenCalled();
});

test("does not confuse fields aliased to each other", async () => {
  const document = gql`
    query Test {
      fie: foo @client {
        fum: bar
        bar: fum
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
        foo: () => ({ bar: "fum", fum: "bar", __typename: "Foo" }),
      },
    },
  });

  await expect(
    localState.execute({
      client,
      document,
      context: {},
      variables: {},
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({
    data: {
      fie: { fum: "fum", bar: "bar", __typename: "Foo" },
    },
  });
});

test("does not confuse fields aliased to each other with boolean values", async () => {
  const document = gql`
    query Test {
      fie: foo @client {
        fum: bar
        bar: fum
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
        foo: () => ({ bar: true, fum: false, __typename: "Foo" }),
      },
    },
  });

  await expect(
    localState.execute({
      client,
      document,
      context: {},
      variables: {},
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({
    data: {
      fie: { fum: true, bar: false, __typename: "Foo" },
    },
  });
});

test("throws when __typename is aliased in child parent field.", async () => {
  const document = gql`
    query Test {
      fie: foo @client {
        bar: __typename
        __typename: bar
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
        foo: () => ({ bar: true, __typename: "Foo" }),
      },
    },
  });

  await expect(
    localState.execute({
      client,
      document,
      context: {},
      variables: {},
      remoteResult: undefined,
    })
  ).rejects.toEqual(
    new LocalStateError(
      "'__typename' is a forbidden field alias name in the selection set for field 'foo' when using local resolvers.",
      { path: ["foo"] }
    )
  );
});

test("throws when __typename is aliased in server parent field", async () => {
  const document = gql`
    query Member {
      member {
        __typename: firstName
        bar: __typename
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
        __typename: "John",
        bar: "Member",
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
  ).rejects.toEqual(
    new LocalStateError(
      "'__typename' is a forbidden field alias name in the selection set for field 'member' when using local resolvers.",
      { path: ["member"] }
    )
  );
});
