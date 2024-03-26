import { ApolloError, gql } from "../../core/index.js";
import { Response as NodeFetchResponse } from "node-fetch";
import { execute, validate } from "graphql";
import type { GraphQLError } from "graphql";

const createMockFetch = (
  schema: any,
  mockFetchOpts: { validate: boolean } = { validate: true }
) => {
  const mockFetch: (uri: any, options: any) => Promise<Response> = (
    uri,
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
            new NodeFetchResponse(
              JSON.stringify({ errors: validationErrors })
            ) as unknown as Response
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

      resolve(new NodeFetchResponse(stringifiedResult) as unknown as Response);
    });
  };
  return mockFetch;
};

export { createMockFetch };
