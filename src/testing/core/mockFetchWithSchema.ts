import { execute, validate } from "graphql";
import type { GraphQLError, GraphQLSchema } from "graphql";
import { ApolloError, gql } from "../../core/index.js";
import { withCleanup } from "../internal/index.js";

const createMockFetch = (
  schema: GraphQLSchema,
  mockFetchOpts: { validate: boolean } = { validate: true }
) => {
  const prevFetch = window.fetch;

  const mockFetch: (uri: any, options: any) => Promise<Response> = (
    _uri,
    options
  ) => {
    return new Promise(async (resolve) => {
      const body = JSON.parse(options.body);
      const document = gql(body.query);

      if (mockFetchOpts.validate) {
        let validationErrors: readonly Error[] = [];

        try {
          validationErrors = validate(schema, document);
        } catch (e) {
          validationErrors = [
            new ApolloError({ graphQLErrors: [e as GraphQLError] }),
          ];
        }

        if (validationErrors?.length > 0) {
          return resolve(
            new Response(JSON.stringify({ errors: validationErrors }))
          );
        }
      }

      const result = await execute({
        schema,
        document,
        variableValues: body.variables,
        operationName: body.operationName,
      });

      const stringifiedResult = JSON.stringify(result);

      resolve(new Response(stringifiedResult));
    });
  };

  window.fetch = mockFetch;

  const restore = () => {
    window.fetch = prevFetch;
  };

  return withCleanup({ mock: mockFetch, restore }, restore);
};

export { createMockFetch };
