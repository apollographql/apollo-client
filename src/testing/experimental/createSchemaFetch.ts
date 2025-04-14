import { execute, GraphQLError, validate } from "graphql";
import type { GraphQLFormattedError, GraphQLSchema } from "graphql";
import { gql } from "../../core/index.js";
import { withCleanup } from "../internal/index.js";
import { wait } from "../core/wait.js";

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
 * @deprecated `createSchemaFetch` is deprecated and will be removed in 3.12.0.
 * Please migrate to [`@apollo/graphql-testing-library`](https://github.com/apollographql/graphql-testing-library).
 */
const createSchemaFetch = (
  schema: GraphQLSchema,
  mockFetchOpts: {
    validate?: boolean;
    delay?: { min: number; max: number };
  } = { validate: true }
) => {
  const prevFetch = window.fetch;
  const delayMin = mockFetchOpts.delay?.min ?? 3;
  const delayMax = mockFetchOpts.delay?.max ?? delayMin + 2;

  if (delayMin > delayMax) {
    throw new Error(
      "Please configure a minimum delay that is less than the maximum delay. The default minimum delay is 3ms."
    );
  }

  const mockFetch: (uri?: any, options?: any) => Promise<Response> = async (
    _uri,
    options
  ) => {
    if (delayMin > 0) {
      const randomDelay = Math.random() * (delayMax - delayMin) + delayMin;
      await wait(randomDelay);
    }

    const body = JSON.parse(options.body);
    const document = gql(body.query);

    if (mockFetchOpts.validate) {
      let validationErrors: readonly GraphQLFormattedError[] = [];

      try {
        validationErrors = validate(schema, document);
      } catch (e) {
        validationErrors = [
          e instanceof Error ?
            GraphQLError.prototype.toJSON.apply(e)
          : (e as any),
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

  function mockGlobal() {
    window.fetch = mockFetch;

    const restore = () => {
      if (window.fetch === mockFetch) {
        window.fetch = prevFetch;
      }
    };

    return withCleanup({ restore }, restore);
  }

  return Object.assign(mockFetch, {
    mockGlobal,
    // if https://github.com/rbuckton/proposal-using-enforcement lands
    // [Symbol.enter]: mockGlobal
  });
};

export { createSchemaFetch };
