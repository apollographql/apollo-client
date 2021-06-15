import { maybe } from "../common/maybe";
import global from "../common/global";

const originalProcessDescriptor = global &&
  Object.getOwnPropertyDescriptor(global, "process");

let needToUndo = false;

// The process.env.NODE_ENV expression can be provided in two different ways:
// either process.env.NODE_ENV works because a literal globalThis.process object
// exists, or it works because a build step replaces the process.env.NODE_ENV
// expression with a string literal like "production" or "development" at build
// time. This maybe(() => process.env.NODE_ENV) expression works in either case,
// because it preserves the syntax of the process.env.NODE_ENV expression,
// allowing the replacement strategy to produce maybe(() => "production"), and
// defaulting to undefined if NODE_ENV is unavailable for any reason.
if (!maybe(() => process.env.NODE_ENV) &&
    // Don't try to define global.process unless it will succeed.
    (!originalProcessDescriptor || originalProcessDescriptor.configurable)) {
  Object.defineProperty(global, "process", {
    value: {
      env: {
        // This default needs to be "production" instead of "development", to
        // avoid the problem https://github.com/graphql/graphql-js/pull/2894
        // will eventually solve, once merged and released.
        NODE_ENV: "production",
      }
    },
    // Let anyone else change global.process as they see fit, but hide it from
    // Object.keys(global) enumeration.
    configurable: true,
    enumerable: false,
    writable: true,
  });

  // We expect this to be true now.
  needToUndo = "process" in global;
}

export function undo() {
  if (needToUndo) {
    if (originalProcessDescriptor) {
      Object.defineProperty(global, "process", originalProcessDescriptor);
    } else {
      delete (global as any).process;
    }
    needToUndo = false;
  }
}
