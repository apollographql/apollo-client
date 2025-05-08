import { ApolloCache, ApolloClient, InMemoryCache } from "@apollo/client";
import { LocalResolversError } from "@apollo/client/errors";
import { ApolloLink } from "@apollo/client/link";
import { LocalResolvers } from "@apollo/client/local-resolvers";
import { spyOnConsole } from "@apollo/client/testing/internal";

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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Foo: {
        baz: () => false,
      },
    },
  });

  await expect(
    localResolvers.execute({ document, client, context: {}, remoteResult })
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        foo: () => ({ bar: true, __typename: "ClientData" }),
      },
    },
  });

  await expect(
    localResolvers.execute({ document, client, context: {}, remoteResult })
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

  const localResolvers = new LocalResolvers({
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
    localResolvers.execute({ document, client, context: {}, remoteResult })
  ).resolves.toStrictEqualTyped({
    data: {
      foo: [
        { __typename: "Bar", bar: "Bar" },
        { __typename: "Baz", baz: "Baz" },
      ],
    },
  });
});

test("warns when cache does not implement fragmentMatches", async () => {
  // @ts-expect-error we don't care about the cache methods for this test
  class TestCache extends ApolloCache {}

  using _ = spyOnConsole("warn");
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo", bar: true }),
      },
    },
  });

  await expect(
    localResolvers.execute({ document, client, context: {} })
  ).resolves.toStrictEqualTyped({
    data: {
      foo: { __typename: "Foo", bar: true },
    },
  });

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "The configured cache does not support fragment matching which may lead to incorrect results when executing local resolvers. Please use a cache matches fragments to silence this warning."
  );
});

test("throws error when fragment spread type condition does not match typename", async () => {
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo", bar: true }),
      },
    },
  });

  await expect(
    localResolvers.execute({ document, client, context: {} })
  ).rejects.toThrow(
    new LocalResolversError(
      "Fragment 'FooDetails' cannot be used with type 'Foo' as objects of type 'Foo' can never be of type 'Bar'.",
      { path: ["foo"] }
    )
  );
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        currentUser: () => ({ __typename: "User", id: 1 }),
      },
    },
  });

  await expect(
    localResolvers.execute({ document, client, context: {} })
  ).resolves.toStrictEqualTyped({
    data: {
      currentUser: { __typename: "User", id: 1 },
    },
  });
});
