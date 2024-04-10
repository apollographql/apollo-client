import { execute, validate } from "graphql";
import type { GraphQLError, GraphQLSchema } from "graphql";
import { ApolloError, gql } from "../../core/index.js";
import { withCleanup } from "../internal/index.js";

/**
 * A function that accepts a static `schema` and a `mockFetchOpts` object and
 * returns a disposable object with `mock` and `restore` functions.
 *
 * The `mock` function is a mock fetch function that is set on the global
 * `window` object. This function intercepts any fetch requests and
 * returns a response by executing the operation against the provided schema.
 *
 * The `restore` function is a cleanup function that will restore the previous
 * `fetch`. It is automatically called if the function's return value is
 * declared with `using`. If your environment does not support the language
 * feature `using`, you should manually invoke the `restore` function.
 *
 * @param schema - A `GraphQLSchema`.
 * @param mockFetchOpts - Configuration options.
 * @returns An object with both `mock` and `restore` functions.
 *
 * @example
 * ```js
 * using _fetch = createSchemaFetch(schema); // automatically restores fetch after exiting the block
 *
 * const { restore } = createSchemaFetch(schema);
 * restore(); // manually restore fetch if `using` is not supported
 * ```
 * @since 3.10.0
 * @alpha
 */
const createSchemaFetch = (
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

export { createSchemaFetch };
