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
      foo @client {
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
          apollo: { source: "LocalResolversLink" },
        },
      },
    ],
  });

  await expect(stream).toComplete();
});

test("handles errors thrown in a child resolver", async () => {
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
          apollo: { source: "LocalResolversLink" },
        },
      },
    ],
  });

  await expect(stream).toComplete();
});

test("adds errors for each field that throws errors", async () => {
  const query = gql`
    query Test {
      foo @client {
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
          apollo: { source: "LocalResolversLink" },
        },
      },
      {
        message: "Baz error",
        path: ["foo", "baz"],
        extensions: {
          apollo: { source: "LocalResolversLink" },
        },
      },
    ],
  });

  await expect(stream).toComplete();
});

test("handles errors thrown in a child resolver from parent array", async () => {
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
          apollo: { source: "LocalResolversLink" },
        },
      },
      {
        message: "Something went wrong",
        path: ["foo", 1, "bar"],
        extensions: {
          apollo: { source: "LocalResolversLink" },
        },
      },
    ],
  });

  await expect(stream).toComplete();
});

test("handles errors thrown in a child resolver for an array from a single item", async () => {
  const query = gql`
    query Test {
      foo @client {
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
          apollo: { source: "LocalResolversLink" },
        },
      },
    ],
  });

  await expect(stream).toComplete();
});

test("serializes a thrown GraphQLError and merges extensions", async () => {
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
          apollo: { source: "LocalResolversLink" },
        },
      },
    ],
  });

  await expect(stream).toComplete();
});

test("concatenates client errors with server errors", async () => {
  const query = gql`
    query Test {
      foo @client {
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
          apollo: { source: "LocalResolversLink" },
        },
      },
    ],
  });

  await expect(stream).toComplete();
});
