import { execute, validate } from "graphql";
import type { GraphQLError, GraphQLSchema } from "graphql";
import { ApolloError, gql } from "../../core/index.js";
import { withCleanup } from "../internal/index.js";
import { wait } from "./wait.js";

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
  mockFetchOpts: {
    validate?: boolean;
    delay?: { min: number; max: number };
  } = { validate: true }
) => {
  const prevFetch = window.fetch;

  const mockFetch: (uri?: any, options?: any) => Promise<Response> = async (
    _uri,
    options
  ) => {
    const delayMin = mockFetchOpts.delay?.min ?? 3;
    const delayMax = mockFetchOpts.delay?.max ?? delayMin + 2;

    if (delayMin > 0) {
      if (delayMin > delayMax) {
        console.log("should throw");
        throw new Error(
          "Please configure a minimum delay that is less than the maximum delay. The default minimum delay is 3ms."
        );
      } else {
        const randomDelay = Math.random() * (delayMax - delayMin) + delayMin;
        await wait(randomDelay);
      }
    }

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
        return new Response(JSON.stringify({ errors: validationErrors }));
      }
    }

    const result = await execute({
      schema,
      document,
      variableValues: body.variables,
      operationName: body.operationName,
    });

    const stringifiedResult = JSON.stringify(result);

    return new Response(stringifiedResult);
  };

  window.fetch = mockFetch;

  const restore = () => {
    window.fetch = prevFetch;
  };

  return withCleanup({ mock: mockFetch, restore }, restore);
};

export { createSchemaFetch };
