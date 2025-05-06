import { of } from "rxjs";

import { ApolloCache, ApolloClient, InMemoryCache } from "@apollo/client";
import { LocalResolversError } from "@apollo/client/errors";
import { ApolloLink } from "@apollo/client/link";
import { LocalResolversLink } from "@apollo/client/link/local-resolvers";
import { MockLink } from "@apollo/client/testing";
import {
  executeWithDefaultContext as execute,
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";

import { gql } from "./testUtils.js";

test("handles @local fields inside fragments", async () => {
  const query = gql`
    fragment Foo on Foo {
      bar
      ...Foo2
    }
    fragment Foo2 on Foo {
      __typename
      baz @local
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

  const serverQuery = gql`
    fragment Foo on Foo {
      bar
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

  const mockLink = new MockLink([
    {
      request: { query: serverQuery },
      result: {
        data: {
          foo: { bar: true, __typename: "Foo" },
          bar: { baz: true, __typename: "Bar" },
        },
      },
    },
  ]);

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Foo: {
        baz: () => false,
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      foo: { bar: true, baz: false, __typename: "Foo" },
      bar: { baz: true, __typename: "Bar" },
    },
  });

  await expect(stream).toComplete();
});

test("handles a mix of @local fields with fragments and server fields", async () => {
  const query = gql`
    fragment client on ClientData {
      bar
      __typename
    }

    query Mixed {
      foo @local {
        ...client
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
      result: { data: { bar: { baz: true, __typename: "Bar" } } },
    },
  ]);

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ bar: true, __typename: "ClientData" }),
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      foo: { bar: true, __typename: "ClientData" },
      bar: { baz: true, __typename: "Bar" },
    },
  });

  await expect(stream).toComplete();
});

it("matches fragments with fragment conditions", async () => {
  const query = gql`
    {
      foo {
        ... on Bar {
          bar @local
        }
        ... on Baz {
          baz @local
        }
      }
    }
  `;

  const mockLink = new ApolloLink(() =>
    of({
      data: { foo: [{ __typename: "Bar" }, { __typename: "Baz" }] },
    })
  );

  const localResolversLink = new LocalResolversLink({
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

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }, { client }));

  await expect(stream).toEmitTypedValue({
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
  const query = gql`
    fragment Foo on Foo {
      bar
    }
    query {
      foo @local {
        ...Foo
      }
    }
  `;

  const client = new ApolloClient({
    cache: new TestCache(),
    link: ApolloLink.empty(),
  });

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo", bar: true }),
      },
    },
  });
  const stream = new ObservableStream(execute(link, { query }, { client }));

  await expect(stream).toEmitTypedValue({
    data: {
      foo: { __typename: "Foo", bar: true },
    },
  });
  await expect(stream).toComplete();

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "The configured cache does not support fragment matching which may lead to incorrect results when executing local resolvers. Please use a cache matches fragments to silence this warning."
  );
});

test("emits error when fragment spread type condition does not match typename", async () => {
  const query = gql`
    fragment FooDetails on Bar {
      bar
    }
    query {
      foo @local {
        ...FooDetails
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

  await expect(stream).toEmitError(
    new LocalResolversError(
      "Fragment 'FooDetails' cannot be used with type 'Foo' as objects of type 'Foo' can never be of type 'Bar'.",
      { path: ["foo"] }
    )
  );
});

test("can use a fragments on interface types defined by possibleTypes", async () => {
  const query = gql`
    query {
      currentUser @local {
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

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        currentUser: () => ({ __typename: "User", id: 1 }),
      },
    },
  });
  const stream = new ObservableStream(execute(link, { query }, { client }));

  await expect(stream).toEmitTypedValue({
    data: {
      currentUser: { __typename: "User", id: 1 },
    },
  });
  await expect(stream).toComplete();
});
