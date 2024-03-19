import { invariant as originalInvariant, InvariantError } from "ts-invariant";
import { version } from "../../version.js";
import global from "./global.js";
import type { ErrorCodes } from "../../invariantErrorCodes.js";
import { stringifyForDisplay } from "../common/stringifyForDisplay.js";

function wrap(fn: (msg?: string, ...args: any[]) => void) {
  return function (message?: string | number, ...args: any[]) {
    if (typeof message === "number") {
      const arg0 = message;
      message = getHandledErrorMsg(arg0);
      if (!message) {
        message = getFallbackErrorMsg(arg0, args);
        args = [];
      }
    }
    fn(...[message].concat(args));
  };
}

type LogFunction = {
  /**
   * Logs a `$level` message if the user used `ts-invariant`'s `setVerbosity` to set
   * a verbosity level of `$level` or lower. (defaults to `"log"`).
   *
   * The user will either be presented with a link to the documentation for the message,
   * or they can use the `loadDevMessages` to add the message strings to the bundle.
   * The documentation will display the message without argument substitution.
   * Instead, the arguments will be printed on the console after the link.
   *
   * `message` can only be a string, a concatenation of strings, or a ternary statement
   * that results in a string. This will be enforced on build, where the message will
   * be replaced with a message number.
   *
   * String substitutions like %s, %o, %d or %f are supported.
   */
  (message?: any, ...optionalParams: unknown[]): void;
};

type WrappedInvariant = {
  /**
   * Throws and InvariantError with the given message if the condition is false.
   *
   * `message` can only be a string, a concatenation of strings, or a ternary statement
   * that results in a string. This will be enforced on build, where the message will
   * be replaced with a message number.
   *
   * The user will either be presented with a link to the documentation for the message,
   * or they can use the `loadErrorMessages` to add the message strings to the bundle.
   * The documentation will display the message with the arguments substituted.
   *
   * String substitutions with %s are supported and will also return
   * pretty-stringified objects.
   * Excess `optionalParams` will be swallowed.
   */
  (
    condition: any,
    message?: string | number,
    ...optionalParams: unknown[]
  ): asserts condition;

  debug: LogFunction;
  log: LogFunction;
  warn: LogFunction;
  error: LogFunction;
};
const invariant: WrappedInvariant = Object.assign(
  function invariant(
    condition: any,
    message?: string | number,
    ...args: unknown[]
  ): asserts condition {
    if (!condition) {
      originalInvariant(
        condition,
        getHandledErrorMsg(message, args) || getFallbackErrorMsg(message, args)
      );
    }
  },
  {
    debug: wrap(originalInvariant.debug),
    log: wrap(originalInvariant.log),
    warn: wrap(originalInvariant.warn),
    error: wrap(originalInvariant.error),
  }
);

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
function newInvariantError(
  message?: string | number,
  ...optionalParams: unknown[]
) {
  return new InvariantError(
    getHandledErrorMsg(message, optionalParams) ||
      getFallbackErrorMsg(message, optionalParams)
  );
}

const ApolloErrorMessageHandler = Symbol.for(
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
  return typeof arg == "string" ? arg : (
      stringifyForDisplay(arg, 2).slice(0, 1000)
    );
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

export {
  invariant,
  InvariantError,
  newInvariantError,
  ApolloErrorMessageHandler,
};
