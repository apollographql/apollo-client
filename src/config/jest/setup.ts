//@ts-ignore
globalThis.__DEV__ = true;

import { TextDecoder, TextEncoder } from "util";

import gql from "graphql-tag";

global.TextEncoder ??= TextEncoder;
// @ts-ignore
global.TextDecoder ??= TextDecoder;
import "@testing-library/jest-dom";
import "../../testing/matchers/index.js";
import { setLogVerbosity } from "@apollo/client";
import { loadErrorMessageHandler } from "@apollo/client/dev";

import { areCombinedGraphQLErrorsEqual } from "./areCombinedGraphQLErrorsEqual.js";
import { areCombinedProtocolErrorsEqual } from "./areCombinedProtocolErrorsEqual.js";
import { areGraphQLErrorsEqual } from "./areGraphQlErrorsEqual.js";
import { areMissingFieldErrorsEqual } from "./areMissingFieldErrorsEqual.js";

setLogVerbosity("log");

// Turn off warnings for repeated fragment names
gql.disableFragmentWarnings();

process.on("unhandledRejection", () => {});

loadErrorMessageHandler();

function fail(reason = "fail was called in a test.") {
  expect(reason).toBe(undefined);
}

// @ts-ignore
globalThis.fail = fail;

if (!Symbol.dispose) {
  Object.defineProperty(Symbol, "dispose", {
    value: Symbol("dispose"),
  });
}
if (!Symbol.asyncDispose) {
  Object.defineProperty(Symbol, "asyncDispose", {
    value: Symbol("asyncDispose"),
  });
}

// @ts-ignore
expect.addEqualityTesters([
  areCombinedGraphQLErrorsEqual,
  areCombinedProtocolErrorsEqual,
  areGraphQLErrorsEqual,
  areMissingFieldErrorsEqual,
]);

// not available in JSDOM 🙄
global.structuredClone = (val) => JSON.parse(JSON.stringify(val));
global.ReadableStream ||= require("stream/web").ReadableStream;
AbortSignal.timeout = (ms) => {
  const controller = new AbortController();
  setTimeout(
    () =>
      controller.abort(
        new DOMException("The operation timed out.", "TimeoutError")
      ),
    ms
  );
  return controller.signal;
};
