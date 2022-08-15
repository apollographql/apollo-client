import type { Readable } from "stream";
import { Operation } from "../core";
import { throwServerError } from "../utils";
import { Observer } from "../../utilities";
import { handleError } from "./HttpLink";

const { hasOwnProperty } = Object.prototype;

export type ServerParseError = Error & {
  response: Response;
  statusCode: number;
  bodyText: string;
};

function parseHeaders(headerText: string): Record<string, string> {
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

function parseJsonBody<T>(response: Response, bodyText: string): T {
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

export function readMultipartBody<T = Record<string, unknown>>(
  // TODO: better type for `response` since response.body can be many things
  // depending on the environment, and the builtin type for Response.body
  // is the browser's ReadableStream<Uint8Array> | null
  response: Response,
  observer: Observer<T>
) {
  const ctype =
    response.headers instanceof Headers
      ? response.headers.get("content-type")
      : (response.headers["content-type"] || response.headers['Content-Type']);

  if (!ctype || !/^multipart\/mixed/.test(ctype)) {
    throw new Error("Invalid multipart content type");
  }
  // From meros https://github.com/maraisr/meros/blob/main/src/node.ts L91,95-98
  let idx_boundary = ctype.indexOf("boundary=");
  let boundary = `--${
    !!~idx_boundary
      ? // +9 for 'boundary='.length
        ctype
          .substring(idx_boundary + 9)
          .trim()
          .replace(/['"]/g, "")
      : "-" // if no boundary is specified, default to -
    }`;
  if (response.body === null) {
    throw new Error("Missing body");
  } else if (typeof response.body.tee === "function") {
    readMultipartWebStream<T>(response, response.body, boundary, observer);
  } else if (typeof (response.body as unknown as Readable).on === "function") {
    readMultipartNodeStream<T>(
      response,
      response.body as unknown as Readable,
      boundary,
      observer
    );
  } else if (typeof response.body === "string") {
    readMultipartString<T>(response, response.body, boundary, observer);
  } else if (
    typeof (response.body as unknown as Buffer).byteLength === "number"
  ) {
    readMultipartBuffer<T>(
      response,
      response.body as unknown as Buffer,
      boundary,
      observer
    );
  } else {
    throw new Error(
      "Streaming bodies not supported by provided fetch implementation"
    );
  }
}

async function readMultipartWebStream<T>(
  response: Response,
  // Not sure if the string case is possible but we’ll handle it anyways.
  body: ReadableStream<Uint8Array>,
  boundary: string,
  observer: Observer<T>
) {
  // TODO: What if TextDecoder isn’t defined globally?
  // do feature detection and use buffer.from
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  // TODO: End message boundary???
  const reader = body.getReader();
  let result: ReadableStreamDefaultReadResult<Uint8Array>;

  while (!(result = await reader.read()).done) {
    const chunk =
      typeof result.value === "string"
        ? result.value
        : decoder.decode(result.value);
    buffer += chunk;
    let bi = buffer.indexOf(boundary);
    while (bi > -1) {
      let message: string;
      [message, buffer] = [
        buffer.slice(0, bi),
        buffer.slice(bi + boundary.length),
      ];
      observeNextResult<T>(message, response, observer);
      bi = buffer.indexOf(boundary);
    }
  }
  observer.complete?.();
}

function observeNextResult<T>(
  message: string,
  response: Response,
  observer: Observer<T>
) {
  if (message.trim()) {
    const i = message.indexOf("\r\n\r\n");
    const headers = parseHeaders(message.slice(0, i));
    const contentType = headers["content-type"];
    if (contentType && contentType.indexOf("application/json") === -1) {
      // TODO: handle unsupported chunk content type
      throw new Error("Unsupported patch content type");
    }
    const body = message.slice(i);
    const result = parseJsonBody<T>(response, body);
    observer.next?.(result);
  }
}

function readMultipartNodeStream<T>(
  response: Response,
  body: Readable,
  boundary: string,
  observer: Observer<T>
) {
  let buffer = "";
  body.on("data", (chunk) => {
    chunk = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    buffer += chunk;
    let bi = buffer.indexOf(boundary);
    while (bi > -1) {
      let message: string;
      [message, buffer] = [
        buffer.slice(0, bi),
        buffer.slice(bi + boundary.length),
      ];
      observeNextResult<T>(message, response, observer);
      bi = buffer.indexOf(boundary);
    }
  });
  body.on("error", (err) => {
    observer.error?.(err);
  });
  body.on("end", () => {
    observer.complete?.();
  });
}

function readMultipartBuffer<T>(
  response: Response,
  body: Uint8Array | Buffer,
  boundary: string,
  observer: Observer<T>
) {
  let text: string;
  if (body.toString.length > 0) {
    text = body.toString("utf8");
  } else {
    const decoder = new TextDecoder("utf8");
    text = decoder.decode(body);
  }
  readMultipartString<T>(response, text, boundary, observer);
}

function readMultipartString<T>(
  response: Response,
  body: string,
  boundary: string,
  observer: Observer<T>
) {
  let buffer = body;
  let bi = buffer.indexOf(boundary);
  while (bi > -1) {
    let message: string;
    [message, buffer] = [
      buffer.slice(0, bi),
      buffer.slice(bi + boundary.length),
    ];
    observeNextResult<T>(message, response, observer);
    bi = buffer.indexOf(boundary);
  }
  observer.complete?.();
}
