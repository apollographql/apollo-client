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
import {
  loadDevMessages,
  loadErrorMessageHandler,
  loadErrorMessages,
} from "@apollo/client/dev";

import { areCombinedGraphQLErrorsEqual } from "./areCombinedGraphQLErrorsEqual.js";
import { areCombinedProtocolErrorsEqual } from "./areCombinedProtocolErrorsEqual.js";
import { areGraphQLErrorsEqual } from "./areGraphQlErrorsEqual.js";
import { areMissingFieldErrorsEqual } from "./areMissingFieldErrorsEqual.js";
import { areNetworkErrorsEqual } from "./areNetworkErrorsEqual.js";
import { areServerErrorsEqual } from "./areServerErrorsEqual.js";

setLogVerbosity("log");

// Turn off warnings for repeated fragment names
gql.disableFragmentWarnings();

process.on("unhandledRejection", () => {});

if (process.env.TEST_ENV === "ci") {
  // in CI, we work with the compiled code, so we need to load the error messages
  loadDevMessages();
  loadErrorMessages();
} else {
  // locally, the error messages are in the source code, so we need to load the
  // error message handler
  loadErrorMessageHandler();
}

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
  areServerErrorsEqual,
  areCombinedGraphQLErrorsEqual,
  areCombinedProtocolErrorsEqual,
  areGraphQLErrorsEqual,
  areMissingFieldErrorsEqual,
  areNetworkErrorsEqual,
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
