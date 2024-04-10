import { graphql, HttpResponse } from "msw";
import { execute } from "graphql";
import { gql } from "@apollo/client";
import { createMockSchema, createProxiedSchema } from "@apollo/client/testing";
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

const schema = createMockSchema(staticSchema, {
  Int: () => 6,
  Float: () => 22.1,
  String: () => "string",
});

export let schemaProxy = createProxiedSchema(schema, resolvers);

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
