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

export function getContentTypeHeaders(response: Response) {
  if (!response.headers) return null;
  return typeof response.headers?.get === "function"
    ? response.headers?.get("content-type")
    : // @ts-ignore
      response.headers["content-type"];
}

export async function readMultipartBody<T = Record<string, unknown>>(
  response: Response,
  observer: Observer<T>
) {
  // TODO: What if TextDecoder isn’t defined globally?
  const decoder = new TextDecoder("utf-8");
  const ctype = getContentTypeHeaders(response);
  // Adapted from meros https://github.com/maraisr/meros/blob/main/src/node.ts
  // L91, 95-98
  let idx_boundary = ctype?.indexOf("boundary=") || -1;
  let boundary = `--${
    !!~idx_boundary
      ? // +9 for 'boundary='.length
        ctype
          ?.substring(idx_boundary + 9)
          .trim()
          .replace(/['"]/g, "")
      : "-" // if no boundary is specified, default to -
  }`;

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
        if (contentType && contentType.indexOf("application/json") === -1) {
          // TODO: handle unsupported chunk content type
          throw new Error("Unsupported patch content type");
        }
        const body = message.slice(i);

        // TODO: where should I be handling \r\n characters, presumably not here
        // TODO: use readJsonBody here instead to handle network errors
        try {
          const result = parseJsonBody<T>(
            response,
            body.replace("\r\n", "")
          );
          observer.next?.(result);
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
      const name = line.slice(0, i).trim();
      const value = line.slice(i + 1).trim();
      headersInit[name] = value;
    }
  });
  return headersInit;
}

export function parseJsonBody<T>(response: Response, bodyText: string): T {
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
  // (and react-apollo) the `graphqlErrors` and `networErrors` to
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
  response
    .text()
    .then((bodyText) => parseJsonBody<T>(response, bodyText))
    .then((result) => {
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
          `Server response was missing for query '${operation.operationName}'.`
        );
      }
      observer.next?.(result);
      observer.complete?.();
    })
    .catch((err) => handleError(err, observer));
}

// TODO: refactor
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
