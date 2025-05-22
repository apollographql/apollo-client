import { ApolloCache, ApolloClient, InMemoryCache } from "@apollo/client";
import { ApolloLink } from "@apollo/client/link";
import { LocalState } from "@apollo/client/local-state";
import { InvariantError } from "@apollo/client/utilities/invariant";

import { gql } from "./testUtils.js";

test("handles @client fields inside fragments", async () => {
  const document = gql`
    fragment Foo on Foo {
      bar
      ...Foo2
    }
    fragment Foo2 on Foo {
      __typename
      baz @client
    }
    query Mixed {
      foo {
        ...Foo
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

  const remoteResult = {
    data: {
      foo: { bar: true, __typename: "Foo" },
      bar: { baz: true, __typename: "Bar" },
    },
  };

  const localState = new LocalState({
    resolvers: {
      Foo: {
        baz: () => false,
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
      foo: { bar: true, baz: false, __typename: "Foo" },
      bar: { baz: true, __typename: "Bar" },
    },
  });
});

test("handles a mix of @client fields with fragments and server fields", async () => {
  const document = gql`
    fragment client on ClientData {
      bar
      __typename
    }

    query Mixed {
      foo @client {
        ...client
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

  const remoteResult = { data: { bar: { baz: true, __typename: "Bar" } } };

  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => ({ bar: true, __typename: "ClientData" }),
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
      foo: { bar: true, __typename: "ClientData" },
      bar: { baz: true, __typename: "Bar" },
    },
  });
});

it("matches fragments with fragment conditions", async () => {
  const document = gql`
    {
      foo {
        ... on Bar {
          bar @client
        }
        ... on Baz {
          baz @client
        }
      }
    }
  `;

  const remoteResult = {
    data: { foo: [{ __typename: "Bar" }, { __typename: "Baz" }] },
  };

  const localState = new LocalState({
    resolvers: {
      Bar: {
        bar: () => "Bar",
      },
      Baz: {
        baz: () => "Baz",
      },
    },
  });

  const client = new ApolloClient({
    cache: new InMemoryCache({
      possibleTypes: {
        Foo: ["Bar", "Baz"],
      },
    }),
    link: ApolloLink.empty(),
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
      foo: [
        { __typename: "Bar", bar: "Bar" },
        { __typename: "Baz", baz: "Baz" },
      ],
    },
  });
});

test("throws when cache does not implement fragmentMatches", async () => {
  // @ts-expect-error we don't care about the cache methods for this test
  class TestCache extends ApolloCache {}

  const document = gql`
    fragment Foo on Foo {
      bar
    }
    query {
      foo @client {
        ...Foo
      }
    }
  `;

  const client = new ApolloClient({
    cache: new TestCache(),
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
  ).rejects.toEqual(
    new InvariantError(
      "The configured cache does not support fragment matching which will lead to incorrect results when executing local resolvers. Please use a cache that implements `fragmetMatches`."
    )
  );
});

test("does not traverse fragment when fragment spread type condition does not match typename", async () => {
  const document = gql`
    fragment FooDetails on Bar {
      bar
    }
    query {
      foo @client {
        ...FooDetails
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
  ).resolves.toStrictEqualTyped({ data: { foo: { __typename: "Foo" } } });
});

test("can use a fragments on interface types defined by possibleTypes", async () => {
  const document = gql`
    query {
      currentUser @client {
        ...ProfileDetails
      }
    }

    fragment ProfileDetails on Profile {
      id
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache({ possibleTypes: { Profile: ["User"] } }),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentUser: () => ({ __typename: "User", id: 1 }),
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
      currentUser: { __typename: "User", id: 1 },
    },
  });
});
