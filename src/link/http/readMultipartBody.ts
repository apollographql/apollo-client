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

// Headers is a DOM global
function parseHeaders(headerText: string): Headers {
  const headersInit: Record<string, string> = {};
  headerText.split("\n").forEach((line) => {
    const i = line.indexOf(":");
    if (i > -1) {
      const name = line.slice(0, i).trim();
      const value = line.slice(i + 1).trim();
      headersInit[name] = value;
    }
  });

  return new Headers(headersInit);
}

// TODO: better return type
function parseJSONBody(response: Response, bodyText: string): any {
  try {
    return JSON.parse(bodyText);
  } catch (err) {
    const parseError = err as ServerParseError;
    parseError.name = "ServerParseError";
    parseError.response = response;
    parseError.statusCode = response.status;
    parseError.bodyText = bodyText;
    throw parseError;
  }
}

export function readJsonBody(
  response: Response,
  operation: Operation,
  observer: Observer<any>
) {
  response
    .text()
    .then((bodyText) => parseJSONBody(response, bodyText))
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
          `Server response was missing for query '${operation.operationName}'.`
        );
      }

      observer.next?.(result);
      observer.complete?.();
    })
    .catch((err) => handleError(err, observer));
}

export function readMultipartBody(response: Response, observer: Observer<any>) {
  const contentType = response.headers.get("content-type");
  if (!contentType || !/^multipart\/mixed/.test(contentType)) {
    throw new Error("Invalid multipart content type");
  }

  // TODO: better parsing of boundary attribute?
  let boundary = contentType.split("boundary=")[1];
  if (boundary) {
    boundary = boundary.replace(/^('|")/, "").replace(/('|")$/, "");
  } else {
    boundary = "-";
  }

  // response.body can be one of many things depending on the environment, so
  // we try to handle all of these cases.
  if (response.body === null) {
    throw new Error("Missing body");
  } else if (typeof response.body.tee === "function") {
    // WHATWG Stream
    readMultipartWebStream(response, response.body, boundary, observer);
  } else if (typeof (response.body as any).on === "function") {
    readMultipartNodeStream(
      response,
      response.body as unknown as Readable,
      boundary,
      observer
    );
  } else if (typeof response.body === "string") {
    readMultipartString(response, response.body, boundary, observer);
  } else if (typeof (response.body as any).byteLength === "number") {
    readMultipartBuffer(response, response.body as any, boundary, observer);
  } else {
    throw new Error(
      "Streaming bodies not supported by provided fetch implementation"
    );
  }
}

async function readMultipartWebStream(
  response: Response,
  // Not sure if the string case is possible but we’ll handle it anyways.
  body: ReadableStream<Uint8Array>,
  boundary: string,
  observer: Observer<any>
) {
  // TODO: What if TextDecoder isn’t defined globally?
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  const messageBoundary = getMessageBoundary(boundary);
  // TODO: End message boundary???
  const reader = body.getReader();
  let result: ReadableStreamDefaultReadResult<Uint8Array>;

  while (!(result = await reader.read()).done) {
    const chunk =
      typeof result.value === "string"
        ? result.value
        : decoder.decode(result.value);
    buffer += chunk;
    // buffer index
    let bi = buffer.indexOf(messageBoundary);
    while (bi > -1) {
      let message: string;
      [message, buffer] = [
        buffer.slice(0, bi),
        buffer.slice(bi + messageBoundary.length),
      ];
      observeNextResult(message, response, observer);
      bi = buffer.indexOf(messageBoundary);
    }
  }
  observer.complete?.();
}

function observeNextResult(message: string, response: Response, observer: Observer<any>) {
  if (message.trim()) {
    const i = message.indexOf("\r\n\r\n");
    const headers = parseHeaders(message.slice(0, i));
    const contentType = headers.get("content-type");
    if (
      contentType !== null &&
      contentType.indexOf("application/json") === -1
    ) {
      // TODO: handle this case
      throw new Error("Unsupported patch content type");
    }

    const body = message.slice(i);
    // body here doesn’t make sense because it will be a readable stream
    const result = parseJSONBody(response, body);
    observer.next?.(result);
  }
}

function readMultipartNodeStream(
  response: Response,
  body: Readable,
  boundary: string,
  observer: Observer<any>
) {
  let buffer = "";
  const messageBoundary = getMessageBoundary(boundary);
  body.on("data", (chunk) => {
    chunk = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    // buffer index
    buffer += chunk;
    // TODO: deduplicate logic with readMultipartWebStream
    let bi = buffer.indexOf(messageBoundary);
    while (bi > -1) {
      let message: string;
      [message, buffer] = [
        buffer.slice(0, bi),
        buffer.slice(bi + messageBoundary.length),
      ];
      observeNextResult(message, response, observer);
      bi = buffer.indexOf(messageBoundary);
    }
  });
  body.on("error", (err) => {
    observer.error?.(err);
  });
  body.on("end", () => {
    observer.complete?.();
  });
}

function readMultipartBuffer(
  response: Response,
  body: Uint8Array | Buffer,
  boundary: string,
  observer: Observer<any>
) {
  let text: string;
  if (body.toString.length > 0) {
    // Node buffer because toString() takes multiple arguments
    text = body.toString("utf8");
  } else {
    const decoder = new TextDecoder("utf8");
    text = decoder.decode(body);
  }
  readMultipartString(response, text, boundary, observer);
}

function getMessageBoundary(boundary: string) {
  return "--" + boundary;
}

function readMultipartString(
  response: Response,
  body: string,
  boundary: string,
  observer: Observer<any>
) {
  let buffer = body;
  const messageBoundary = getMessageBoundary(boundary);
  let bi = buffer.indexOf(messageBoundary);
  while (bi > -1) {
    let message: string;
    [message, buffer] = [
      buffer.slice(0, bi),
      buffer.slice(bi + messageBoundary.length),
    ];
    observeNextResult(message, response, observer);
    bi = buffer.indexOf(messageBoundary);
  }
  observer.complete?.();
}
