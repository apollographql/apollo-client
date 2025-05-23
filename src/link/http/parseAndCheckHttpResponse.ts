import {
  CombinedProtocolErrors,
  PROTOCOL_ERRORS_SYMBOL,
  ServerError,
  ServerParseError,
} from "@apollo/client/errors";
import type { ApolloPayloadResult, Operation } from "@apollo/client/link";
import { isNonNullObject } from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

const { hasOwnProperty } = Object.prototype;

/**
 * This function detects an Apollo payload result before it is transformed
 * into a FetchResult via HttpLink; it cannot detect an ApolloPayloadResult
 * once it leaves the link chain.
 */
function isApolloPayloadResult(value: unknown): value is ApolloPayloadResult {
  return isNonNullObject(value) && "payload" in value;
}

export async function readMultipartBody<
  T extends object = Record<string, unknown>,
>(response: Response, nextValue: (value: T) => void) {
  if (TextDecoder === undefined) {
    throw new Error(
      "TextDecoder must be defined in the environment: please import a polyfill."
    );
  }
  const decoder = new TextDecoder("utf-8");
  const contentType = response.headers?.get("content-type");
  const delimiter = "boundary=";

  // parse boundary value and ignore any subsequent name/value pairs after ;
  // https://www.rfc-editor.org/rfc/rfc9110.html#name-parameters
  // e.g. multipart/mixed;boundary="graphql";deferSpec=20220824
  // if no boundary is specified, default to -
  const boundaryVal =
    contentType?.includes(delimiter) ?
      contentType
        ?.substring(contentType?.indexOf(delimiter) + delimiter.length)
        .replace(/['"]/g, "")
        .replace(/\;(.*)/gm, "")
        .trim()
    : "-";

  const boundary = `\r\n--${boundaryVal}`;
  let buffer = "";
  invariant(
    response.body && typeof response.body.getReader === "function",
    "Unknown type for `response.body`. Please use a `fetch` implementation that is WhatWG-compliant and that uses WhatWG ReadableStreams for `body`."
  );
  const iterator = response.body.getReader();
  let running = true;

  while (running) {
    const { value, done } = await iterator.read();
    const chunk = typeof value === "string" ? value : decoder.decode(value);
    const searchFrom = buffer.length - boundary.length + 1;
    running = !done;
    buffer += chunk;
    let bi = buffer.indexOf(boundary, searchFrom);

    while (bi > -1) {
      let message: string;
      [message, buffer] = [
        buffer.slice(0, bi),
        buffer.slice(bi + boundary.length),
      ];
      const i = message.indexOf("\r\n\r\n");
      const headers = parseHeaders(message.slice(0, i));
      const contentType = headers["content-type"];
      if (
        contentType &&
        contentType.toLowerCase().indexOf("application/json") === -1
      ) {
        throw new Error(
          "Unsupported patch content type: application/json is required."
        );
      }
      // nb: Technically you'd want to slice off the beginning "\r\n" but since
      // this is going to be `JSON.parse`d there is no need.
      const body = message.slice(i);

      if (body) {
        const result = parseJsonBody<T>(response, body);
        if (
          Object.keys(result).length > 1 ||
          "data" in result ||
          "incremental" in result ||
          "errors" in result ||
          "payload" in result
        ) {
          if (isApolloPayloadResult(result)) {
            let next = {};
            if ("payload" in result) {
              if (Object.keys(result).length === 1 && result.payload === null) {
                return;
              }
              next = { ...result.payload };
            }
            if ("errors" in result) {
              next = {
                ...next,
                extensions: {
                  ...("extensions" in next ? next.extensions : (null as any)),
                  [PROTOCOL_ERRORS_SYMBOL]: new CombinedProtocolErrors(
                    result.errors ?? []
                  ),
                },
              };
            }
            nextValue(next as T);
          } else {
            // for the last chunk with only `hasNext: false`
            // we don't need to call observer.next as there is no data/errors
            nextValue(result);
          }
        } else if (
          // If the chunk contains only a "hasNext: false", we can call
          // observer.complete() immediately.
          Object.keys(result).length === 1 &&
          "hasNext" in result &&
          !result.hasNext
        ) {
          return;
        }
      }
      bi = buffer.indexOf(boundary);
    }
  }
}

function parseHeaders(headerText: string): Record<string, string> {
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

function parseJsonEncoding(response: Response, bodyText: string) {
  if (response.status >= 300) {
    throw new ServerError(
      `Response not successful: Received status code ${response.status}`,
      { response, bodyText }
    );
  }

  try {
    return JSON.parse(bodyText);
  } catch (err) {
    throw new ServerParseError(err, { response, bodyText });
  }
}

function parseGraphQLResponseJsonEncoding(
  response: Response,
  bodyText: string
) {
  try {
    return JSON.parse(bodyText);
  } catch (err) {
    throw new ServerParseError(err, { response, bodyText });
  }
}

function parseGraphQLResponse(response: Response, bodyText: string) {
  const contentType = response.headers.get("content-type");

  if (contentType === null) {
    throw new ServerError(
      "Could not determine content encoding because the 'content-type' header is missing.",
      { response, bodyText }
    );
  }

  if (contentType.includes("application/json")) {
    return parseJsonEncoding(response, bodyText);
  }

  if (contentType.includes("application/graphql-response+json")) {
    return parseGraphQLResponseJsonEncoding(response, bodyText);
  }

  throw new ServerError(`Unsupported mime type: '${contentType}'`, {
    response,
    bodyText,
  });
}

function parseJsonBody<T>(response: Response, bodyText: string): T {
  if (response.status >= 300) {
    throw new ServerError(
      `Response not successful: Received status code ${response.status}`,
      { response, bodyText }
    );
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch (err) {
    throw new ServerParseError(err, { response, bodyText });
  }
}

export function parseAndCheckHttpResponse(operations: Operation | Operation[]) {
  return (response: Response) =>
    response.text().then((bodyText) => {
      const result = parseGraphQLResponse(response, bodyText);

      if (
        !Array.isArray(result) &&
        !hasOwnProperty.call(result, "data") &&
        !hasOwnProperty.call(result, "errors")
      ) {
        throw new ServerError(
          `Server response was missing for query '${
            Array.isArray(operations) ?
              operations.map((op) => op.operationName)
            : operations.operationName
          }'.`,
          { response, bodyText }
        );
      }
      return result;
    });
}
