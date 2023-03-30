import '../utilities/globals';

import { GraphQLError, GraphQLErrorExtensions } from 'graphql';

import { isNonEmptyArray } from '../utilities';
import { ServerParseError } from '../link/http';
import { ServerError } from '../link/utils';
import { FetchResult } from "../link/core";

// This Symbol allows us to pass transport-specific errors from the link chain
// into QueryManager/client internals without risking a naming collision within
// extensions (which implementers can use as they see fit).
export const PROTOCOL_ERRORS_SYMBOL: unique symbol = Symbol();

type FetchResultWithSymbolExtensions<T> = FetchResult<T> & {
  extensions: Record<string | symbol, any>
};

export interface ApolloErrorOptions {
  graphQLErrors?: ReadonlyArray<GraphQLError>;
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
  return err.hasOwnProperty('graphQLErrors');
}

// Sets the error message on this error according to the
// the GraphQL and network errors that are present.
// If the error message has already been set through the
// constructor or otherwise, this function is a nop.
const generateErrorMessage = (err: ApolloError) => {
  let message = '';
  // If we have GraphQL errors present, add that to the error message.
  if (
    isNonEmptyArray(err.graphQLErrors) ||
    isNonEmptyArray(err.clientErrors) ||
    isNonEmptyArray(err.protocolErrors)
  ) {
    const errors = ((err.graphQLErrors || []) as readonly Error[])
      .concat(err.clientErrors || [])
      .concat((err.protocolErrors || []) as readonly Error[]);
    errors.forEach((error: Error) => {
      const errorMessage = error
        ? error.message
        : 'Error message not found.';
      message += `${errorMessage}\n`;
    });
  }

  if (err.networkError) {
    message += `${err.networkError.message}\n`;
  }

  // strip newline from the end of the message
  message = message.replace(/\n$/, '');
  return message;
};

export type GraphQLErrors = ReadonlyArray<GraphQLError>;

export type NetworkError = Error | ServerParseError | ServerError | null;

export class ApolloError extends Error {
  public name: string;
  public message: string;
  public graphQLErrors: GraphQLErrors;
  public protocolErrors: ReadonlyArray<{
    message: string;
    extensions?: GraphQLErrorExtensions[];
  }>;
  public clientErrors: ReadonlyArray<Error>;
  public networkError: Error | ServerParseError | ServerError | null;

  // An object that can be used to provide some additional information
  // about an error, e.g. specifying the type of error this is. Used
  // internally within Apollo Client.
  public extraInfo: any;

  // Constructs an instance of ApolloError given a GraphQLError
  // or a network error. Note that one of these has to be a valid
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
    this.name = 'ApolloError';
    this.graphQLErrors = graphQLErrors || [];
    this.protocolErrors = protocolErrors || [];
    this.clientErrors = clientErrors || [];
    this.networkError = networkError || null;
    this.message = errorMessage || generateErrorMessage(this);
    this.extraInfo = extraInfo;

    // We're not using `Object.setPrototypeOf` here as it isn't fully
    // supported on Android (see issue #3236).
    (this as any).__proto__ = ApolloError.prototype;
  }
}
