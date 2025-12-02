import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";

test("can use `from` with writeFragment", async () => {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    data: {
      id: 1,
      a: 1,
      b: 2,
      __typename: "Foo",
    },
    from: { __typename: "Foo", id: 1 },
    fragment: gql`
      fragment foo on Foo {
        id
        a
        b
      }
    `,
  });

  expect(client.extract()).toEqual({
    __META: {
      extraRootIds: ["Foo:1"],
    },
    "Foo:1": {
      __typename: "Foo",
      id: 1,
      a: 1,
      b: 2,
    },
  });

  client.writeFragment({
    data: {
      c: 3,
      d: 4,
      __typename: "Foo",
    },
    from: { __ref: "Foo:1" },
    fragment: gql`
      fragment foo on Foo {
        c
        d
      }
    `,
  });

  expect(client.extract()).toEqual({
    __META: {
      extraRootIds: ["Foo:1"],
    },
    "Foo:1": {
      __typename: "Foo",
      id: 1,
      a: 1,
      b: 2,
      c: 3,
      d: 4,
    },
  });

  client.writeFragment({
    data: {
      e: 5,
      f: 6,
      __typename: "Foo",
    },
    from: "Foo:1",
    fragment: gql`
      fragment foo on Foo {
        e
        f
      }
    `,
  });

  expect(client.extract()).toEqual({
    __META: {
      extraRootIds: ["Foo:1"],
    },
    "Foo:1": {
      __typename: "Foo",
      id: 1,
      a: 1,
      b: 2,
      c: 3,
      d: 4,
      e: 5,
      f: 6,
    },
  });
});
