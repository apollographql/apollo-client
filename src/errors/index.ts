import "../utilities/globals/index.js";

import type {
  GraphQLError,
  GraphQLErrorExtensions,
  GraphQLFormattedError,
} from "graphql";

import { isNonNullObject } from "../utilities/index.js";
import type { ServerParseError } from "../link/http/index.js";
import type { ServerError } from "../link/utils/index.js";
import type { FetchResult } from "../link/core/index.js";

// This Symbol allows us to pass transport-specific errors from the link chain
// into QueryManager/client internals without risking a naming collision within
// extensions (which implementers can use as they see fit).
export const PROTOCOL_ERRORS_SYMBOL: unique symbol = Symbol();

type FetchResultWithSymbolExtensions<T> = FetchResult<T> & {
  extensions: Record<string | symbol, any>;
};

export interface ApolloErrorOptions {
  graphQLErrors?: ReadonlyArray<GraphQLFormattedError>;
  protocolErrors?: ReadonlyArray<{
    message: string;
    extensions?: GraphQLErrorExtensions[];
  }>;
  clientErrors?: ReadonlyArray<Error>;
  networkError?: Error | ServerParseError | ServerError | null;
  errorMessage?: string;
  extraInfo?: any;
}

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

export function isApolloError(err: Error): err is ApolloError {
  return err.hasOwnProperty("graphQLErrors");
}

// Sets the error message on this error according to the
// the GraphQL and network errors that are present.
// If the error message has already been set through the
// constructor or otherwise, this function is a nop.
const generateErrorMessage = (err: ApolloError) => {
  const errors = [
    ...err.graphQLErrors,
    ...err.clientErrors,
    ...err.protocolErrors,
  ];
  if (err.networkError) errors.push(err.networkError);
  return (
    errors
      // The rest of the code sometimes unsafely types non-Error objects as GraphQLErrors
      .map(
        (err) =>
          (isNonNullObject(err) && err.message) || "Error message not found."
      )
      .join("\n")
  );
};

/**
 * @deprecated This type is deprecated and will be removed in the next major version of Apollo Client.
 * It mistakenly referenced `GraqhQLError` instead of `GraphQLFormattedError`.
 *
 * Use `ReadonlyArray<GraphQLFormattedError>` instead.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export type GraphQLErrors = ReadonlyArray<GraphQLError>;

export type NetworkError = Error | ServerParseError | ServerError | null;

export class ApolloError extends Error {
  public name: string;
  public message: string;
  public graphQLErrors: ReadonlyArray<GraphQLFormattedError>;
  public protocolErrors: ReadonlyArray<{
    message: string;
    extensions?: GraphQLErrorExtensions[];
  }>;
  public clientErrors: ReadonlyArray<Error>;
  public networkError: Error | ServerParseError | ServerError | null;
  /**
   * Indicates the specific original cause of the error.
   *
   * This field contains the first available `networkError`, `graphQLError`, `protocolError`, `clientError`, or `null` if none are available.
   */
  public cause:
    | ({
        readonly message: string;
        extensions?:
          | GraphQLErrorExtensions[]
          | GraphQLFormattedError["extensions"];
      } & Omit<Partial<Error> & Partial<GraphQLFormattedError>, "extensions">)
    | null;

  // An object that can be used to provide some additional information
  // about an error, e.g. specifying the type of error this is. Used
  // internally within Apollo Client.
  public extraInfo: any;

  // Constructs an instance of ApolloError given serialized GraphQL errors,
  // client errors, protocol errors or network errors.
  // Note that one of these has to be a valid
  // value or the constructed error will be meaningless.
  constructor({
    graphQLErrors,
    protocolErrors,
    clientErrors,
    networkError,
    errorMessage,
    extraInfo,
  }: ApolloErrorOptions) {
    super(errorMessage);
    this.name = "ApolloError";
    this.graphQLErrors = graphQLErrors || [];
    this.protocolErrors = protocolErrors || [];
    this.clientErrors = clientErrors || [];
    this.networkError = networkError || null;
    this.message = errorMessage || generateErrorMessage(this);
    this.extraInfo = extraInfo;
    this.cause =
      [
        networkError,
        ...(graphQLErrors || []),
        ...(protocolErrors || []),
        ...(clientErrors || []),
      ].find((e) => !!e) || null;

    // We're not using `Object.setPrototypeOf` here as it isn't fully
    // supported on Android (see issue #3236).
    (this as any).__proto__ = ApolloError.prototype;
  }
}
