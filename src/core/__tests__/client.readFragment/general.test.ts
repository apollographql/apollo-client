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
