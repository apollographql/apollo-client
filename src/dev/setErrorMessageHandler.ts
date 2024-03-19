import type { ErrorCodes } from "../invariantErrorCodes.js";
import { global } from "../utilities/globals/index.js";
import { ApolloErrorMessageHandler } from "../utilities/globals/invariantWrappers.js";

/**
 * The error message handler is a function that is called when a message is
 * logged or an error is thrown to determine the contents of the error message
 * to be logged or thrown.
 */
export type ErrorMessageHandler = {
  /**
   * @param message - Usually the error message number (as defined in
   * `@apollo/client/invariantErrorCodes.js`).
   * In some edge cases, this can already be a string, that can be passed through
   * as an error message.
   *
   * @param args - The placeholders that can be passed into the error message (pre-stringified).
   * These relate with the `%s` and `%d` [substitution strings](https://developer.mozilla.org/en-US/docs/Web/API/console#using_string_substitutions)
   * in the error message defined in `@apollo/client/invariantErrorCodes.js`.
   *
   * ⚠️ Note that arguments will only be passed in for error messages.
   * For normal log messages, you will get an empty array here and they will directly
   * be passed to `console.log` instead, to have the string subsitution done by the
   * engine, as that allows for nicer (and in the case of a browser, interactive)
   * output.
   *
   * @returns The error message to be logged or thrown. If it returns `undefined`,
   *          the mechanism will fall back to the default:
   *          A link to https://go.apollo.dev/c/err with Apollo Client version,
   *          the error message number, and the error message arguments encoded into
   *          the URL hash.
   */ (message: string | number, args: string[]): string | undefined;
};

/**
 * Overrides the global "Error Message Handler" with a custom implementation.
 */
export function setErrorMessageHandler(handler: ErrorMessageHandler) {
  global[ApolloErrorMessageHandler] = handler as typeof handler & ErrorCodes;
}
