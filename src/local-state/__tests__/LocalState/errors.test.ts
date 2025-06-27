import { GraphQLError } from "graphql";

import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { LocalState } from "@apollo/client/local-state";

import { gql } from "./testUtils.js";

test("handles errors thrown in a resolver", async () => {
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
        foo: () => {
          throw new Error("Something went wrong");
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
    data: { foo: null },
    errors: [
      {
        message: "Something went wrong",
        path: ["foo"],
        extensions: {
          localState: {
            resolver: "Query.foo",
            cause: new Error("Something went wrong"),
          },
        },
      },
    ],
  });
});

test("handles errors thrown in a child resolver", async () => {
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
        foo: () => ({ __typename: "Foo" }),
      },
      Foo: {
        bar: () => {
          throw new Error("Something went wrong");
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
    data: { foo: { __typename: "Foo", bar: null } },
    errors: [
      {
        message: "Something went wrong",
        path: ["foo", "bar"],
        extensions: {
          localState: {
            resolver: "Foo.bar",
            cause: new Error("Something went wrong"),
          },
        },
      },
    ],
  });
});

test("adds errors for each field that throws errors", async () => {
  const document = gql`
    query Test {
      foo @client {
        bar
        baz
        qux
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
        bar: () => {
          throw new Error("Bar error");
        },
        baz: () => {
          throw new Error("Baz error");
        },
        qux: () => true,
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
    data: { foo: { __typename: "Foo", bar: null, baz: null, qux: true } },
    errors: [
      {
        message: "Bar error",
        path: ["foo", "bar"],
        extensions: {
          localState: {
            resolver: "Foo.bar",
            cause: new Error("Bar error"),
          },
        },
      },
      {
        message: "Baz error",
        path: ["foo", "baz"],
        extensions: {
          localState: {
            resolver: "Foo.baz",
            cause: new Error("Baz error"),
          },
        },
      },
    ],
  });
});

test("handles errors thrown in a child resolver from parent array", async () => {
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
        foo: () => [{ __typename: "Foo" }, { __typename: "Foo" }],
      },
      Foo: {
        bar: () => {
          throw new Error("Something went wrong");
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
      foo: [
        { __typename: "Foo", bar: null },
        { __typename: "Foo", bar: null },
      ],
    },
    errors: [
      {
        message: "Something went wrong",
        path: ["foo", 0, "bar"],
        extensions: {
          localState: {
            resolver: "Foo.bar",
            cause: new Error("Something went wrong"),
          },
        },
      },
      {
        message: "Something went wrong",
        path: ["foo", 1, "bar"],
        extensions: {
          localState: {
            resolver: "Foo.bar",
            cause: new Error("Something went wrong"),
          },
        },
      },
    ],
  });
});

test("handles errors thrown in a child resolver for an array from a single item", async () => {
  const document = gql`
    query Test {
      foo @client {
        id
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
        foo: () => [
          { __typename: "Foo", id: 1 },
          { __typename: "Foo", id: 2 },
        ],
      },
      Foo: {
        bar: (parent) => {
          if (parent.id === 2) {
            throw new Error("Something went wrong");
          }

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
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({
    data: {
      foo: [
        { __typename: "Foo", id: 1, bar: true },
        { __typename: "Foo", id: 2, bar: null },
      ],
    },
    errors: [
      {
        message: "Something went wrong",
        path: ["foo", 1, "bar"],
        extensions: {
          localState: {
            resolver: "Foo.bar",
            cause: new Error("Something went wrong"),
          },
        },
      },
    ],
  });
});

test("serializes a thrown GraphQLError and merges extensions", async () => {
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
        foo: () => {
          throw new GraphQLError("Something went wrong", {
            extensions: { custom: true },
          });
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
    data: { foo: null },
    errors: [
      {
        message: "Something went wrong",
        path: ["foo"],
        extensions: {
          custom: true,
          localState: {
            resolver: "Query.foo",
            cause: new GraphQLError("Something went wrong", {
              extensions: { custom: true },
            }),
          },
        },
      },
    ],
  });
});

test("overwrites localState extension from thrown GraphQLError if provided", async () => {
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
        foo: () => {
          throw new GraphQLError("Something went wrong", {
            extensions: { localState: { shouldNotBeSeen: true } },
          });
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
    data: { foo: null },
    errors: [
      {
        message: "Something went wrong",
        path: ["foo"],
        extensions: {
          localState: {
            resolver: "Query.foo",
            cause: new GraphQLError("Something went wrong", {
              extensions: { localState: { shouldNotBeSeen: true } },
            }),
          },
        },
      },
    ],
  });
});

test("concatenates client errors with server errors", async () => {
  const document = gql`
    query Test {
      foo @client {
        bar
      }
      baz {
        qux
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const remoteResult = {
    data: { baz: { __typename: "Baz", qux: null } },
    errors: [{ message: "Could not get qux", path: ["baz", "qux"] }],
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => {
          throw new Error("Something went wrong");
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
    data: { foo: null, baz: { __typename: "Baz", qux: null } },
    errors: [
      { message: "Could not get qux", path: ["baz", "qux"] },
      {
        message: "Something went wrong",
        path: ["foo"],
        extensions: {
          localState: {
            resolver: "Query.foo",
            cause: new Error("Something went wrong"),
          },
        },
      },
    ],
  });
});

test("handles errors thrown in async resolvers", async () => {
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
        foo: async () => {
          throw new Error("Something went wrong");
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
    data: { foo: null },
    errors: [
      {
        message: "Something went wrong",
        path: ["foo"],
        extensions: {
          localState: {
            resolver: "Query.foo",
            cause: new Error("Something went wrong"),
          },
        },
      },
    ],
  });
});

test("handles rejected promises returned in async resolvers", async () => {
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
        foo: async () => {
          return Promise.reject(new Error("Something went wrong"));
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
    data: { foo: null },
    errors: [
      {
        message: "Something went wrong",
        path: ["foo"],
        extensions: {
          localState: {
            resolver: "Query.foo",
            cause: new Error("Something went wrong"),
          },
        },
      },
    ],
  });
});

test("handles errors thrown for resolvers on fields inside fragments", async () => {
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
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const remoteResult = {
    data: {
      foo: { bar: true, __typename: `Foo` },
    },
  };

  const localState = new LocalState({
    resolvers: {
      Foo: {
        baz: () => {
          throw new Error("Could not get baz");
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
      foo: { bar: true, baz: null, __typename: "Foo" },
    },
    errors: [
      {
        message: "Could not get baz",
        path: ["foo", "baz"],
        extensions: {
          localState: {
            resolver: "Foo.baz",
            cause: new Error("Could not get baz"),
          },
        },
      },
    ],
  });
});

test("handles remote errors with no local resolver errors", async () => {
  const document = gql`
    query Test {
      foo @client {
        bar
      }
      baz {
        qux
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const remoteResult = {
    data: { baz: { __typename: "Baz", qux: null } },
    errors: [{ message: "Could not get qux", path: ["baz", "qux"] }],
  };

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
      baz: { __typename: "Baz", qux: null },
    },
    errors: [{ message: "Could not get qux", path: ["baz", "qux"] }],
  });
});
