import { version } from "../../version.js";
import type { ErrorCodes } from "../../invariantErrorCodes.js";
import { global } from "@apollo/client/utilities/globals";
import { stringifyForDisplay } from "../common/stringifyForDisplay.js";
import { __DEV__ } from "@apollo/client/utilities/environment";

export class InvariantError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "InvariantError";
  }
}

const verbosityLevels = ["debug", "log", "warn", "error", "silent"] as const;
type VerbosityLevel = (typeof verbosityLevels)[number];
type ConsoleMethodName = Exclude<VerbosityLevel, "silent">;
let verbosityLevel = verbosityLevels.indexOf(__DEV__ ? "log" : "silent");

export function invariant(
  condition: any,
  ...args: [message?: string | number, ...any[]]
): asserts condition {
  if (!condition) {
    throw newInvariantError(...args);
  }
}

function wrapConsoleMethod<M extends ConsoleMethodName>(name: M) {
  return function (message?: string | number, ...args: any[]) {
    if (verbosityLevels.indexOf(name) >= verbosityLevel) {
      // Default to console.log if this host environment happens not to provide
      // all the console.* methods we need.
      const method = console[name] || console.log;

      const arg0 = message;
      message = getHandledErrorMsg(arg0);
      if (!message) {
        message = getFallbackErrorMsg(arg0, args);
        args = [];
      }

      method(message, ...args);
    }
  } as (typeof console)[M];
}

invariant.debug = wrapConsoleMethod("debug");
invariant.log = wrapConsoleMethod("log");
invariant.warn = wrapConsoleMethod("warn");
invariant.error = wrapConsoleMethod("error");

export function setVerbosity(level: VerbosityLevel): VerbosityLevel {
  const old = verbosityLevels[verbosityLevel];
  verbosityLevel = Math.max(0, verbosityLevels.indexOf(level));
  return old;
}

/**
 * Returns an InvariantError.
 *
 * `message` can only be a string, a concatenation of strings, or a ternary statement
 * that results in a string. This will be enforced on build, where the message will
 * be replaced with a message number.
 * String substitutions with %s are supported and will also return
 * pretty-stringified objects.
 * Excess `optionalParams` will be swallowed.
 */
export function newInvariantError(
  message?: string | number,
  ...optionalParams: unknown[]
) {
  return new InvariantError(
    getHandledErrorMsg(message, optionalParams) ||
      getFallbackErrorMsg(message, optionalParams)
  );
}

export const ApolloErrorMessageHandler = Symbol.for(
  "ApolloErrorMessageHandler_" + version
);
declare global {
  interface Window {
    [ApolloErrorMessageHandler]?: {
      (message: string | number, args: string[]): string | undefined;
    } & ErrorCodes;
  }
}

function stringify(arg: any) {
  if (typeof arg == "string") {
    return arg;
  }

  try {
    return stringifyForDisplay(arg, 2).slice(0, 1000);
  } catch {
    return "<non-serializable>";
  }
}

function getHandledErrorMsg(
  message?: string | number,
  messageArgs: unknown[] = []
) {
  if (!message) return;
  return (
    global[ApolloErrorMessageHandler] &&
    global[ApolloErrorMessageHandler](message, messageArgs.map(stringify))
  );
}

function getFallbackErrorMsg(
  message?: string | number,
  messageArgs: unknown[] = []
) {
  if (!message) return;
  return `An error occurred! For more details, see the full error text at https://go.apollo.dev/c/err#${encodeURIComponent(
    JSON.stringify({
      version,
      message,
      args: messageArgs.map(stringify),
    })
  )}`;
}
