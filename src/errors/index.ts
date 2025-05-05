import type { FetchResult } from "@apollo/client/link";

import { CombinedProtocolErrors } from "./CombinedProtocolErrors.js";
import { isErrorLike } from "./isErrorLike.js";
import { UnconventionalError } from "./UnconventionalError.js";

// This Symbol allows us to pass transport-specific errors from the link chain
// into QueryManager/client internals without risking a naming collision within
// extensions (which implementers can use as they see fit).
export const PROTOCOL_ERRORS_SYMBOL: unique symbol = Symbol();

type FetchResultWithSymbolExtensions<T> = FetchResult<T> & {
  extensions: Record<string | symbol, any>;
};

export function graphQLResultHasProtocolErrors<T>(
  result: FetchResult<T>
): result is FetchResultWithSymbolExtensions<T> {
  if (result.extensions) {
    return CombinedProtocolErrors.is(
      (result as FetchResultWithSymbolExtensions<T>).extensions[
        PROTOCOL_ERRORS_SYMBOL
      ]
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
export { LinkError, registerLinkError } from "./LinkError.js";
export { ServerError } from "./ServerError.js";
export { ServerParseError } from "./ServerParseError.js";
export { UnconventionalError } from "./UnconventionalError.js";
