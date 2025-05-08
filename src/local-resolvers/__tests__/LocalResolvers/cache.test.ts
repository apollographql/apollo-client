import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  isReference,
} from "@apollo/client";
import { LocalResolvers } from "@apollo/client/local-resolvers";

import { gql } from "./testUtils.js";

test("can write to the cache with a mutation", async () => {
  const query = gql`
    {
      field
    }
  `;

  const mutation = gql`
    mutation start {
      start @client
    }
  `;

  const localResolvers = new LocalResolvers({
    resolvers: {
      Mutation: {
        start(_data, _args, { client }) {
          client.cache.writeQuery({ query, data: { field: 1 } });
          return true;
        },
      },
    },
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  await expect(
    localResolvers.execute({ document: mutation, client, context: {} })
  ).resolves.toStrictEqualTyped({ data: { start: true } });

  expect(client.readQuery({ query })).toStrictEqualTyped({ field: 1 });
});

test("can write to the cache with a mutation using an ID", async () => {
  const query = gql`
    {
      obj {
        field
      }
    }
  `;

  const mutation = gql`
    mutation start {
      start @client
    }
  `;

  const localResolvers = new LocalResolvers({
    resolvers: {
      Mutation: {
        start(_, __, { client }) {
          client.writeQuery({
            query,
            data: {
              obj: { field: 1, id: "uniqueId", __typename: "Object" },
            },
          });

          client.cache.modify<{ id: string; field: number }>({
            id: "Object:uniqueId",
            fields: {
              field(value) {
                return value + 2;
              },
            },
          });

          return true;
        },
      },
    },
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  await expect(
    localResolvers.execute({ document: mutation, client, context: {} })
  ).resolves.toStrictEqualTyped({ data: { start: true } });

  expect(client.readQuery({ query })).toStrictEqualTyped({
    obj: { __typename: "Object", field: 3 },
  });
});

test("does not overwrite __typename when writing to the cache with an id", async () => {
  const query = gql`
    {
      obj @client {
        field {
          field2
        }
        id
      }
    }
  `;

  const mutation = gql`
    mutation start {
      start @client
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localResolvers = new LocalResolvers({
    resolvers: {
      Mutation: {
        start(_, __, { client }) {
          client.writeQuery({
            query,
            data: {
              obj: {
                field: { field2: 1, __typename: "Field" },
                id: "uniqueId",
                __typename: "Object",
              },
            },
          });
          client.cache.modify<{ field: { field2: number } }>({
            id: "Object:uniqueId",
            fields: {
              field(value) {
                if (isReference(value)) {
                  fail("Should not be a reference");
                }
                expect(value.field2).toBe(1);
                return { ...value, field2: 2 };
              },
            },
          });
          return true;
        },
      },
    },
  });

  await expect(
    localResolvers.execute({ document: mutation, client, context: {} })
  ).resolves.toStrictEqualTyped({ data: { start: true } });

  expect(client.readQuery({ query })).toStrictEqualTyped({
    obj: {
      __typename: "Object",
      field: { __typename: "Field", field2: 2 },
      id: "uniqueId",
    },
  });
});
