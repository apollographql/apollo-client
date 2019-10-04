import { Operation } from '../core';
import { throwServerError } from '../utils/throwServerError';

export type ServerParseError = Error & {
  response: Response;
  statusCode: number;
  bodyText: string;
};

export const parseAndCheckHttpResponse =
  (operations: Operation | Operation[]) => (response: Response) => {
    return (
      response
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
            return Promise.reject(parseError);
          }
        })
        .then((result: any) => {
          if (response.status >= 300) {
            //Network error
            throwServerError(
              response,
              result,
              `Response not successful: Received status code ${response.status}`,
            );
          }

          if (
            !Array.isArray(result) &&
            !result.hasOwnProperty('data') &&
            !result.hasOwnProperty('errors')
          ) {
            //Data error
            throwServerError(
              response,
              result,
              `Server response was missing for query '${
                Array.isArray(operations)
                  ? operations.map(op => op.operationName)
                  : operations.operationName
              }'.`,
            );
          }
          return result;
        })
    );
  };
