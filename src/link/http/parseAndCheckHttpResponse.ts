import { responseIterator } from "./responseIterator";
import { Operation } from "../core";
import { throwServerError } from "../utils";
import { Observer } from "../../utilities";

const { hasOwnProperty } = Object.prototype;

export type ServerParseError = Error & {
  response: Response;
  statusCode: number;
  bodyText: string;
};

export async function readMultipartBody<T = Record<string, unknown>>(
  response: Response,
  observer: Observer<T>
) {
  if (TextDecoder === undefined) {
    throw new Error(
      "TextDecoder must be defined in the environment: please import a polyfill."
    );
  }
  const decoder = new TextDecoder("utf-8");
  const contentType = response.headers?.get('content-type');
  const delimiter = "boundary=";

  // parse boundary value and ignore any subsequent name/value pairs after ;
  // https://www.rfc-editor.org/rfc/rfc9110.html#name-parameters
  // e.g. multipart/mixed;boundary="graphql";deferSpec=20220824
  // if no boundary is specified, default to -
  const boundaryVal = contentType?.includes(delimiter)
    ? contentType
        ?.substring(contentType?.indexOf(delimiter) + delimiter.length)
        .replace(/['"]/g, "")
        .replace(/\;(.*)/gm, "")
        .trim()
    : "-";

  let boundary = `--${boundaryVal}`;
  let buffer = "";
  const iterator = responseIterator(response);
  let running = true;

  while (running) {
    const { value, done } = await iterator.next();
    const chunk = typeof value === "string" ? value : decoder.decode(value);
    running = !done;
    buffer += chunk;
    let bi = buffer.indexOf(boundary);

    while (bi > -1) {
      let message: string;
      [message, buffer] = [
        buffer.slice(0, bi),
        buffer.slice(bi + boundary.length),
      ];
      if (message.trim()) {
        const i = message.indexOf("\r\n\r\n");
        const headers = parseHeaders(message.slice(0, i));
        const contentType = headers["content-type"];
        if (
          contentType &&
          contentType.toLowerCase().indexOf("application/json") === -1
        ) {
          throw new Error("Unsupported patch content type: application/json is required.");
        }
        const body = message.slice(i);

        try {
          const result = parseJsonBody<T>(response, body.replace("\r\n", ""));
          if (
            Object.keys(result).length > 1 ||
            "data" in result ||
            "incremental" in result ||
            "errors" in result
          ) {
            // for the last chunk with only `hasNext: false`,
            // we don't need to call observer.next as there is no data/errors
            observer.next?.(result);
          }
        } catch (err) {
          handleError(err, observer);
        }
      }
      bi = buffer.indexOf(boundary);
    }
  }
  observer.complete?.();
}

export function parseHeaders(headerText: string): Record<string, string> {
  const headersInit: Record<string, string> = {};
  headerText.split("\n").forEach((line) => {
    const i = line.indexOf(":");
    if (i > -1) {
      // normalize headers to lowercase
      const name = line.slice(0, i).trim().toLowerCase();
      const value = line.slice(i + 1).trim();
      headersInit[name] = value;
    }
  });
  return headersInit;
}

export function parseJsonBody<T>(response: Response, bodyText: string): T {
  if (response.status >= 300) {
    // Network error
    const getResult = () => {
      try {
        return JSON.parse(bodyText);
      } catch (err) {
        return bodyText
      }
    }
    throwServerError(
      response,
      getResult(),
      `Response not successful: Received status code ${response.status}`,
    );
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch (err) {
    const parseError = err as ServerParseError;
    parseError.name = "ServerParseError";
    parseError.response = response;
    parseError.statusCode = response.status;
    parseError.bodyText = bodyText;
    throw parseError;
  }
}

export function handleError(err: any, observer: Observer<any>) {
  if (err.name === "AbortError") return;
  // if it is a network error, BUT there is graphql result info fire
  // the next observer before calling error this gives apollo-client
  // (and react-apollo) the `graphqlErrors` and `networkErrors` to
  // pass to UI this should only happen if we *also* have data as
  // part of the response key per the spec
  if (err.result && err.result.errors && err.result.data) {
    // if we don't call next, the UI can only show networkError
    // because AC didn't get any graphqlErrors this is graphql
    // execution result info (i.e errors and possibly data) this is
    // because there is no formal spec how errors should translate to
    // http status codes. So an auth error (401) could have both data
    // from a public field, errors from a private field, and a status
    // of 401
    // {
    //  user { // this will have errors
    //    firstName
    //  }
    //  products { // this is public so will have data
    //    cost
    //  }
    // }
    //
    // the result of above *could* look like this:
    // {
    //   data: { products: [{ cost: "$10" }] },
    //   errors: [{
    //      message: 'your session has timed out',
    //      path: []
    //   }]
    // }
    // status code of above would be a 401
    // in the UI you want to show data where you can, errors as data where you can
    // and use correct http status codes
    observer.next?.(err.result);
  }

  observer.error?.(err);
}

export function readJsonBody<T = Record<string, unknown>>(
  response: Response,
  operation: Operation,
  observer: Observer<T>
) {
  parseAndCheckHttpResponse(operation)(response)
    .then((result) => {
      observer.next?.(result);
      observer.complete?.();
    })
    .catch((err) => handleError(err, observer));
}

export function parseAndCheckHttpResponse(operations: Operation | Operation[]) {
  return (response: Response) =>
    response
      .text()
      .then((bodyText) => parseJsonBody(response, bodyText))
      .then((result: any) => {
        if (response.status >= 300) {
          // Network error
          throwServerError(
            response,
            result,
            `Response not successful: Received status code ${response.status}`
          );
        }
        if (
          !Array.isArray(result) &&
          !hasOwnProperty.call(result, "data") &&
          !hasOwnProperty.call(result, "errors")
        ) {
          // Data error
          throwServerError(
            response,
            result,
            `Server response was missing for query '${
              Array.isArray(operations)
                ? operations.map((op) => op.operationName)
                : operations.operationName
            }'.`
          );
        }
        return result;
      });
}
