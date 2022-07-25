import { Operation } from '../core';
import { ServerError } from '../utils';
const { hasOwnProperty } = Object.prototype;

export type ServerParseError = Error & {
  response: Response;
  statusCode: number;
  bodyText: string;
};

export function parseAndCheckHttpResponse(
  operations: Operation | Operation[],
) {
  return (response: Response) => response
    .text()
    .then(bodyText => {
      try {
        return JSON.parse(bodyText);
      } catch (err) {
        const parseError = err as ServerParseError;
        parseError.name = 'ServerParseError';
        parseError.response = response;
        parseError.statusCode = response.status;
        parseError.bodyText = bodyText;
        throw parseError;
      }
    })
    .then((result: any) => {
      if (response.status >= 300) {
        // Network error
        const message = `Response not successful: Received status code ${response.status}.`;
        const error = new Error(message) as ServerError;
        error.name = 'ServerError';
        error.response = response;
        error.statusCode = response.status;
        result.error = error;
        return result;
      }

      if (
        !Array.isArray(result) &&
        !hasOwnProperty.call(result, 'data') &&
        !hasOwnProperty.call(result, 'errors')
      ) {
        // Data error (Missing a useful response from the server)
        const message = `Server response was missing for query '${
          Array.isArray(operations)
            ? operations.map(op => op.operationName)
            : operations.operationName
        }'.`;
        const error = new Error(message) as ServerError;
        error.name = 'ServerError';
        error.response = response;
        error.statusCode = response.status;
        result.error = error;        
      }
      return result;
    });
}
