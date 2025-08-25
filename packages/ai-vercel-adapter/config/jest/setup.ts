//@ts-ignore
globalThis.__DEV__ = true;

import { TextDecoder, TextEncoder } from "util";
import "@testing-library/jest-dom";

global.TextEncoder ??= TextEncoder;
// @ts-ignore
global.TextDecoder ??= TextDecoder;

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

// not available in JSDOM 🙄
global.structuredClone = (val) => JSON.parse(JSON.stringify(val));
global.ReadableStream ||= require("stream/web").ReadableStream;
global.TransformStream ||= require("stream/web").TransformStream;

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
