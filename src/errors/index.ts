import { CombinedProtocolErrors } from "./CombinedProtocolErrors.js";
import { isErrorLike } from "./isErrorLike.js";
import { UnconventionalError } from "./UnconventionalError.js";

// This Symbol allows us to pass transport-specific errors from the link chain
// into QueryManager/client internals without risking a naming collision within
// extensions (which implementers can use as they see fit).
export const PROTOCOL_ERRORS_SYMBOL: unique symbol = Symbol();

type WithSymbolExtensions<T> = T & {
  extensions: Record<string | symbol, any>;
};

export function graphQLResultHasProtocolErrors<T extends {}>(
  result: T
): result is T & {
  extensions: Record<string | symbol, any>;
} {
  if ("extensions" in result) {
    return CombinedProtocolErrors.is(
      (result as WithSymbolExtensions<T>).extensions[PROTOCOL_ERRORS_SYMBOL]
    );
  }
  return false;
}

export function toErrorLike(error: unknown) {
  if (isErrorLike(error)) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error, { cause: error });
  }

  return new UnconventionalError(error);
}

export { CombinedGraphQLErrors } from "./CombinedGraphQLErrors.js";
export { CombinedProtocolErrors } from "./CombinedProtocolErrors.js";
export { isErrorLike } from "./isErrorLike.js";
export { LinkError, registerLinkError } from "./LinkError.js";
export { LocalStateError } from "./LocalStateError.js";
export { ServerError } from "./ServerError.js";
export { ServerParseError } from "./ServerParseError.js";
export { UnconventionalError } from "./UnconventionalError.js";
