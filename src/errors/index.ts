import type { FetchResult } from "@apollo/client/link/core";
import type { ServerError } from "@apollo/client/link/utils";

import type { ServerParseError } from "./ServerParseError.js";

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
    return Array.isArray(
      (result as FetchResultWithSymbolExtensions<T>).extensions[
        PROTOCOL_ERRORS_SYMBOL
      ]
    );
  }
  return false;
}

export type NetworkError = Error | ServerParseError | ServerError | null;

export { CombinedGraphQLErrors } from "./CombinedGraphQLErrors.js";
export { CombinedProtocolErrors } from "./CombinedProtocolErrors.js";
export { ServerError } from "./ServerError.js";
export { ServerParseError } from "./ServerParseError.js";
export { UnknownError } from "./UnknownError.js";
