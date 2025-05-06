import { of } from "rxjs";

import { ApolloLink } from "@apollo/client";
import { LocalResolversLink } from "@apollo/client/link/local-resolvers";
import {
  executeWithDefaultContext as execute,
  ObservableStream,
} from "@apollo/client/testing/internal";

import { gql } from "./testUtils.js";

test("resolves @local fields mixed with aliased server fields", async () => {
  const query = gql`
    query Aliased {
      foo @local {
        bar
      }
      baz: bar {
        foo
      }
    }
  `;

  const mockLink = new ApolloLink(() =>
    // Each link is responsible for implementing their own aliasing so it
    // returns baz not bar
    of({ data: { baz: { foo: true, __typename: "Baz" } } })
  );

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ bar: true, __typename: "Foo" }),
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      foo: { bar: true, __typename: "Foo" },
      baz: { foo: true, __typename: "Baz" },
    },
  });
  await expect(stream).toComplete();
});

test("resolves aliased @local fields", async () => {
  const aliasedQuery = gql`
    query Test {
      fie: foo @local {
        bar
      }
    }
  `;

  const fie = jest.fn();
  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ bar: true, __typename: "Foo" }),
        fie,
      },
    },
  });
  const stream = new ObservableStream(execute(link, { query: aliasedQuery }));

  await expect(stream).toEmitTypedValue({
    data: { fie: { bar: true, __typename: "Foo" } },
  });
  await expect(stream).toComplete();

  expect(fie).not.toHaveBeenCalled();
});

test("resolves deeply nested aliased @local fields", async () => {
  const query = gql`
    query Test {
      user {
        id
        bestFriend {
          first: firstName
          last: lastName
          name: fullName @local
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
            first: "Test",
            last: "User",
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
          first: "Test",
          last: "User",
          name: "Test User",
        },
      },
    },
  });

  await expect(stream).toComplete();
});

test("respects aliases for *nested fields* on the @local-tagged node", async () => {
  const aliasedQuery = gql`
    query Test {
      fie: foo @local {
        fum: bar
      }
      baz: bar {
        foo
      }
    }
  `;

  const mockLink = new ApolloLink(() =>
    of({ data: { baz: { foo: true, __typename: "Baz" } } })
  );

  const fie = jest.fn();
  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ bar: true, __typename: "Foo" }),
        fie,
      },
    },
  });
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query: aliasedQuery }));

  await expect(stream).toEmitTypedValue({
    data: {
      fie: { fum: true, __typename: "Foo" },
      baz: { foo: true, __typename: "Baz" },
    },
  });
  await expect(stream).toComplete();

  expect(fie).not.toHaveBeenCalled();
});

test("does not confuse fields aliased to each other", async () => {
  const query = gql`
    query Test {
      fie: foo @local {
        fum: bar
        bar: fum
      }
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ bar: "fum", fum: "bar", __typename: "Foo" }),
      },
    },
  });
  const stream = new ObservableStream(execute(link, { query: query }));

  await expect(stream).toEmitTypedValue({
    data: {
      fie: { fum: "fum", bar: "bar", __typename: "Foo" },
    },
  });
  await expect(stream).toComplete();
});

test("does not confuse fields aliased to each other with boolean values", async () => {
  const query = gql`
    query Test {
      fie: foo @local {
        fum: bar
        bar: fum
      }
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ bar: true, fum: false, __typename: "Foo" }),
      },
    },
  });
  const stream = new ObservableStream(execute(link, { query: query }));

  await expect(stream).toEmitTypedValue({
    data: {
      fie: { fum: true, bar: false, __typename: "Foo" },
    },
  });
  await expect(stream).toComplete();
});

test("does not confuse aliased __typename", async () => {
  const query = gql`
    query Test {
      fie: foo @local {
        bar: __typename
        typename: bar
      }
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ bar: true, __typename: "Foo" }),
      },
    },
  });
  const stream = new ObservableStream(execute(link, { query: query }));

  await expect(stream).toEmitTypedValue({
    data: {
      fie: { bar: "Foo", typename: true },
    },
  });
  await expect(stream).toComplete();
});
