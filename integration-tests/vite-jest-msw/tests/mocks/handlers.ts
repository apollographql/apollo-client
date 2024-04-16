import { graphql, HttpResponse } from "msw";
import { execute } from "graphql";
import { gql } from "@apollo/client";
import { createTestSchema } from "@apollo/client/testing/experimental";
import { makeExecutableSchema } from "@graphql-tools/schema";
import Schema from "../schema.graphql";

export const resolvers = {
  Query: {
    products: () => [
      {
        id: "1",
        title: "Blue Jays Hat",
      },
    ],
  },
};

const staticSchema = makeExecutableSchema({ typeDefs: Schema });

export let schemaProxy = createTestSchema(staticSchema, {
  resolvers,
  scalars: {
    Int: () => 6,
    Float: () => 22.1,
    String: () => "string",
  },
});

export const handlers = [
  graphql.operation(async ({ query, variables, operationName }) => {
    const document = gql(query);

    const result = await execute({
      document,
      operationName,
      schema: schemaProxy,
      variableValues: variables,
    });

    return HttpResponse.json(result);
  }),
];
