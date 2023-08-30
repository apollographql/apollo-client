import gql from "graphql-tag";
import "@testing-library/jest-dom";
import { loadErrorMessageHandler } from "../../dev/loadErrorMessageHandler.js";
import "../../testing/matchers/index.js";

// Turn off warnings for repeated fragment names
gql.disableFragmentWarnings();

process.on("unhandledRejection", () => {});

loadErrorMessageHandler();

function fail(reason = "fail was called in a test.") {
  expect(reason).toBe(undefined);
}

// @ts-ignore
globalThis.fail = fail;
