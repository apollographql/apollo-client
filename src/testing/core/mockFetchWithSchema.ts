import { Response as NodeFetchResponse } from "node-fetch";
import { execute } from "graphql";

const createMockFetch = (schema: any) => {
  const mockFetch: (uri: any, options: any) => Promise<Response> = (
    uri,
    options
  ) => {
    // TODO: validation errors

    return new Promise(async (resolve) => {
      const result = await execute({
        schema,
        contextValue: options.context,
        document: options.operation.query,
        variableValues: options.operation.variables,
        operationName: options.operation.operationName,
      });

      const stringifiedResult = JSON.stringify(result);

      resolve(new NodeFetchResponse(stringifiedResult) as unknown as Response);
    });
  };
  return mockFetch;
};

export { createMockFetch };
