import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { LocalResolvers } from "@apollo/client/local-resolvers";

import { gql } from "./testUtils.js";

test("passes client in context to resolvers", async () => {
  const document = gql`
    query WithContext {
      foo @client {
        bar
      }
    }
  `;

  const barResolver = jest.fn(() => 1);
  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo" }),
      },
      Foo: { bar: barResolver },
    },
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  await expect(
    localResolvers.execute({ document, client, context: {} })
  ).resolves.toStrictEqualTyped({
    data: { foo: { __typename: "Foo", bar: 1 } },
  });

  expect(barResolver).toHaveBeenCalledWith(
    { __typename: "Foo" },
    {},
    { client },
    {
      field: expect.objectContaining({
        name: { kind: "Name", value: "bar" },
      }),
      fragmentMap: expect.any(Object),
      path: ["foo", "bar"],
    }
  );
});

test("can access request context in resolvers", async () => {
  const document = gql`
    query WithContext {
      foo @client {
        bar
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
        foo: () => ({ __typename: "Foo" }),
      },
      Foo: {
        bar: (_data, _args, { id }) => id,
      },
    },
  });

  await expect(
    localResolvers.execute({ document, client, context: { id: 1 } })
  ).resolves.toStrictEqualTyped({
    data: { foo: { __typename: "Foo", bar: 1 } },
  });
});
