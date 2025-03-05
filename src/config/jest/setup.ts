import gql from "graphql-tag";
import { TextEncoder, TextDecoder } from "util";
global.TextEncoder ??= TextEncoder;
// @ts-ignore
global.TextDecoder ??= TextDecoder;
import "@testing-library/jest-dom";
import { loadErrorMessageHandler } from "@apollo/client/dev";
import { setLogVerbosity } from "@apollo/client";
import "../../testing/matchers/index.js";
import { areApolloErrorsEqual } from "./areApolloErrorsEqual.js";
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
  areApolloErrorsEqual,
  areGraphQLErrorsEqual,
  areMissingFieldErrorsEqual,
]);

// not available in JSDOM 🙄
global.structuredClone = (val) => JSON.parse(JSON.stringify(val));
