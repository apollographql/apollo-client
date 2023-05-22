import { invariant as i, InvariantError } from "ts-invariant";
import { version } from "../../version";
import global from "./global";
import type { ErrorCodes } from "../../invariantErrorCodes";
import { stringifyForDisplay } from "../common/stringifyForDisplay";

function wrap(fn: (msg?: string, ...args: any[]) => void) {
  return function (message: string | number, ...args: any[]) {
    fn(getErrorMsg(message, () => []), ...args);
  }
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
}

type WrappedInvariant = {
  /**
   * Throws and InvariantError with the given message if the condition is false.
   *
   * `message` can only be a string, a concatenation of strings, or a ternary statement
   * that results in a string. This will be enforced on build, where the message will
   * be replaced with a message number.
   *
   * The user will either be presented with a link to the documentation for the message,
   * or they can use the `loadDevMessages` to add the message strings to the bundle.
   * The documentation will display the message with the arguments substituted.
   *
   * The n-th string `%s` in the message will be replaced with the n-th element
   * of the array returned by the optional `args` function.  
   * Objects will be pretty-stringified with a maximum length of 1000 characters.
   */
  (condition: any, message?: string | number, args?: () => unknown[]): asserts condition
  
  debug: LogFunction;
  log: LogFunction;
  warn: LogFunction;
  error: LogFunction;
}
const invariant: WrappedInvariant = Object.assign(
  function invariant(condition: any, message?: string | number, getArgsLazy?: () => unknown[]): asserts condition {
    if (!condition) {
      i(
        condition,
        getErrorMsg(message, getArgsLazy))
    }
  },
  {
    debug: wrap(i.debug),
    log: wrap(i.log),
    warn: wrap(i.warn),
    error: wrap(i.error)
  }
);

/**
 * Returns an InvariantError.
 *
 * `message` can only be a string, a concatenation of strings, or a ternary statement
 * that results in a string. This will be enforced on build, where the message will
 * be replaced with a message number.
 * The n-th string `%s` in the message will be replaced with the n-th element
 * of the array returned by the optional `args` function.
 */
function newInvariantError(message?: string | number, getArgsLazy?: () => unknown[]) {
  return new InvariantError(getErrorMsg(message, getArgsLazy));
}

const ApolloErrorMessageHandler = Symbol.for('ApolloErrorMessageHandler')
declare global {
	interface Window {
		[ApolloErrorMessageHandler]?: {
      (message: string | number, args: unknown[]): string | undefined
    } & ErrorCodes
	}
}

function getErrorMsg(message?: string | number, getArgsLazy?: () => unknown[]) {
  if (!message) return;
  const args = (getArgsLazy ? getArgsLazy() : []).map(arg => typeof arg == "string" ? arg : stringifyForDisplay(arg, 2).slice(0, 1000));
  return global[ApolloErrorMessageHandler]
    && global[ApolloErrorMessageHandler](message, args)
    || `An error occured! For more details, see the full error text at https://go.apollo.dev/c/err#${encodeURIComponent(JSON.stringify({
      version,
      message,
      args
    }))}`
}

export { invariant, InvariantError, newInvariantError, ApolloErrorMessageHandler }
