import { gql } from "../../core/index.js";
import { Response as NodeFetchResponse } from "node-fetch";
import { execute } from "graphql";

const createMockFetch = (schema: any) => {
  const mockFetch: (uri: any, options: any) => Promise<Response> = (
    uri,
    options
  ) => {
    // TODO: validation errors

    return new Promise(async (resolve) => {
      const body = JSON.parse(options.body);
      const document = gql(body.query);

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
