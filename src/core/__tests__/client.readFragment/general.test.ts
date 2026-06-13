import type { TypedDocumentNode } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";

test("can use `from` with readFragment", async () => {
  const fragment: TypedDocumentNode<
    {
      bar: boolean;
      baz: boolean;
      __typename: "Foo";
    },
    Record<string, never>
  > = gql`
    fragment FooFragment on Foo {
      bar
      baz
    }
  `;

  const client = new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache().restore({
      "Foo:1": {
        __typename: "Foo",
        id: 1,
        bar: true,
        baz: false,
      },
    }),
  });

  expect(
    client.readFragment({
      fragment,
      from: { __typename: "Foo", id: 1 },
    })
  ).toStrictEqualTyped({ __typename: "Foo", bar: true, baz: false });

  expect(
    client.readFragment({
      fragment,
      from: { __ref: "Foo:1" },
    })
  ).toStrictEqualTyped({ __typename: "Foo", bar: true, baz: false });

  expect(
    client.readFragment({
      fragment,
      from: "Foo:1",
    })
  ).toStrictEqualTyped({ __typename: "Foo", bar: true, baz: false });
});

test("respects the optimistic option", () => {
  const fragment: TypedDocumentNode<
    {
      text: string;
      __typename: "Todo";
    },
    Record<string, never>
  > = gql`
    fragment TodoFragment on Todo {
      text
    }
  `;

  const client = new ApolloClient({
    link: ApolloLink.empty(),
    cache: new InMemoryCache().restore({
      "Todo:1": {
        __typename: "Todo",
        id: 1,
        text: "base",
      },
    }),
  });

  client.cache.recordOptimisticTransaction((cache) => {
    cache.writeFragment({
      id: "Todo:1",
      fragment,
      data: { __typename: "Todo", text: "optimistic" },
    });
  }, "optimistic Todo");

  expect(
    client.readFragment({
      fragment,
      from: "Todo:1",
    })
  ).toStrictEqualTyped({ __typename: "Todo", text: "base" });

  expect(
    client.readFragment({
      fragment,
      from: "Todo:1",
      optimistic: true,
    })
  ).toStrictEqualTyped({ __typename: "Todo", text: "optimistic" });
});
