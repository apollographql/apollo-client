import { GraphQLError } from "graphql";
import { of } from "rxjs";

import { ApolloLink } from "@apollo/client";
import { LocalResolversLink } from "@apollo/client/link/local-resolvers";
import {
  executeWithDefaultContext as execute,
  ObservableStream,
} from "@apollo/client/testing/internal";

import { gql } from "./testUtils.js";

test("handles errors thrown in a resolver", async () => {
  const query = gql`
    query Test {
      foo @local {
        bar
      }
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => {
          throw new Error("Something went wrong");
        },
      },
    },
  });

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: { foo: null },
    errors: [
      {
        message: "Something went wrong",
        path: ["foo"],
        extensions: {
          apollo: {
            source: "LocalResolversLink",
            resolver: "Query.foo",
            cause: new Error("Something went wrong"),
          },
        },
      },
    ],
  });

  await expect(stream).toComplete();
});

test("handles errors thrown in a child resolver", async () => {
  const query = gql`
    query Test {
      foo @local {
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
        bar: () => {
          throw new Error("Something went wrong");
        },
      },
    },
  });

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: { foo: { __typename: "Foo", bar: null } },
    errors: [
      {
        message: "Something went wrong",
        path: ["foo", "bar"],
        extensions: {
          apollo: {
            source: "LocalResolversLink",
            resolver: "Foo.bar",
            cause: new Error("Something went wrong"),
          },
        },
      },
    ],
  });

  await expect(stream).toComplete();
});

test("adds errors for each field that throws errors", async () => {
  const query = gql`
    query Test {
      foo @local {
        bar
        baz
        qux
      }
    }
  `;

  const link = new LocalResolversLink({
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

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: { foo: { __typename: "Foo", bar: null, baz: null, qux: true } },
    errors: [
      {
        message: "Bar error",
        path: ["foo", "bar"],
        extensions: {
          apollo: {
            source: "LocalResolversLink",
            resolver: "Foo.bar",
            cause: new Error("Bar error"),
          },
        },
      },
      {
        message: "Baz error",
        path: ["foo", "baz"],
        extensions: {
          apollo: {
            source: "LocalResolversLink",
            resolver: "Foo.baz",
            cause: new Error("Baz error"),
          },
        },
      },
    ],
  });

  await expect(stream).toComplete();
});

test("handles errors thrown in a child resolver from parent array", async () => {
  const query = gql`
    query Test {
      foo @local {
        bar
      }
    }
  `;

  const link = new LocalResolversLink({
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

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
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
          apollo: {
            source: "LocalResolversLink",
            resolver: "Foo.bar",
            cause: new Error("Something went wrong"),
          },
        },
      },
      {
        message: "Something went wrong",
        path: ["foo", 1, "bar"],
        extensions: {
          apollo: {
            source: "LocalResolversLink",
            resolver: "Foo.bar",
            cause: new Error("Something went wrong"),
          },
        },
      },
    ],
  });

  await expect(stream).toComplete();
});

test("handles errors thrown in a child resolver for an array from a single item", async () => {
  const query = gql`
    query Test {
      foo @local {
        id
        bar
      }
    }
  `;

  const link = new LocalResolversLink({
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

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
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
          apollo: {
            source: "LocalResolversLink",
            resolver: "Foo.bar",
            cause: new Error("Something went wrong"),
          },
        },
      },
    ],
  });

  await expect(stream).toComplete();
});

test("serializes a thrown GraphQLError and merges extensions", async () => {
  const query = gql`
    query Test {
      foo @local {
        bar
      }
    }
  `;

  const link = new LocalResolversLink({
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

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: { foo: null },
    errors: [
      {
        message: "Something went wrong",
        path: ["foo"],
        extensions: {
          custom: true,
          apollo: {
            source: "LocalResolversLink",
            resolver: "Query.foo",
            cause: new GraphQLError("Something went wrong", {
              extensions: { custom: true },
            }),
          },
        },
      },
    ],
  });

  await expect(stream).toComplete();
});

test("overwrites apollo extension from thrown GraphQLError if provided", async () => {
  const query = gql`
    query Test {
      foo @local {
        bar
      }
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => {
          throw new GraphQLError("Something went wrong", {
            extensions: { apollo: { shouldNotBeSeen: true } },
          });
        },
      },
    },
  });

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: { foo: null },
    errors: [
      {
        message: "Something went wrong",
        path: ["foo"],
        extensions: {
          apollo: {
            source: "LocalResolversLink",
            resolver: "Query.foo",
            cause: new GraphQLError("Something went wrong", {
              extensions: { apollo: { shouldNotBeSeen: true } },
            }),
          },
        },
      },
    ],
  });

  await expect(stream).toComplete();
});

test("concatenates client errors with server errors", async () => {
  const query = gql`
    query Test {
      foo @local {
        bar
      }
      baz {
        qux
      }
    }
  `;

  const mockLink = new ApolloLink(() => {
    return of({
      data: { baz: { __typename: "Baz", qux: null } },
      errors: [{ message: "Could not get qux", path: ["baz", "qux"] }],
    });
  });

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => {
          throw new Error("Something went wrong");
        },
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: { foo: null, baz: { __typename: "Baz", qux: null } },
    errors: [
      { message: "Could not get qux", path: ["baz", "qux"] },
      {
        message: "Something went wrong",
        path: ["foo"],
        extensions: {
          apollo: {
            source: "LocalResolversLink",
            resolver: "Query.foo",
            cause: new Error("Something went wrong"),
          },
        },
      },
    ],
  });

  await expect(stream).toComplete();
});

test("handles errors thrown in async resolvers", async () => {
  const query = gql`
    query Test {
      foo @local {
        bar
      }
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: async () => {
          throw new Error("Something went wrong");
        },
      },
    },
  });

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: { foo: null },
    errors: [
      {
        message: "Something went wrong",
        path: ["foo"],
        extensions: {
          apollo: {
            source: "LocalResolversLink",
            resolver: "Query.foo",
            cause: new Error("Something went wrong"),
          },
        },
      },
    ],
  });

  await expect(stream).toComplete();
});

test("handles rejected promises returned in async resolvers", async () => {
  const query = gql`
    query Test {
      foo @local {
        bar
      }
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: async () => {
          return Promise.reject(new Error("Something went wrong"));
        },
      },
    },
  });

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: { foo: null },
    errors: [
      {
        message: "Something went wrong",
        path: ["foo"],
        extensions: {
          apollo: {
            source: "LocalResolversLink",
            resolver: "Query.foo",
            cause: new Error("Something went wrong"),
          },
        },
      },
    ],
  });

  await expect(stream).toComplete();
});

test("handles errors thrown for resolvers on fields inside fragments", async () => {
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
    }
  `;

  const mockLink = new ApolloLink(() => {
    return of({
      data: {
        foo: { bar: true, __typename: `Foo` },
      },
    });
  });

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Foo: {
        baz: () => {
          throw new Error("Could not get baz");
        },
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      foo: { bar: true, baz: null, __typename: "Foo" },
    },
    errors: [
      {
        message: "Could not get baz",
        path: ["foo", "baz"],
        extensions: {
          apollo: {
            source: "LocalResolversLink",
            resolver: "Foo.baz",
            cause: new Error("Could not get baz"),
          },
        },
      },
    ],
  });

  await expect(stream).toComplete();
});

test("handles remote errors with no local resolver errors", async () => {
  const query = gql`
    query Test {
      foo @local {
        bar
      }
      baz {
        qux
      }
    }
  `;

  const mockLink = new ApolloLink(() => {
    return of({
      data: { baz: { __typename: "Baz", qux: null } },
      errors: [{ message: "Could not get qux", path: ["baz", "qux"] }],
    });
  });

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
      baz: { __typename: "Baz", qux: null },
    },
    errors: [{ message: "Could not get qux", path: ["baz", "qux"] }],
  });

  await expect(stream).toComplete();
});
