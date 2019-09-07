import { GraphQLError } from 'graphql';
import { isNonEmptyArray } from '../util/arrays';

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
  if (isNonEmptyArray(err.graphQLErrors)) {
    err.graphQLErrors.forEach((graphQLError: GraphQLError) => {
      const errorMessage = graphQLError
        ? graphQLError.message
        : 'Error message not found.';
      message += `GraphQL error: ${errorMessage}\n`;
    });
  }

  if (err.networkError) {
    message += 'Network error: ' + err.networkError.message + '\n';
  }

  // strip newline from the end of the message
  message = message.replace(/\n$/, '');
  return message;
};

export class ApolloError extends Error {
  public message: string;
  public graphQLErrors: ReadonlyArray<GraphQLError>;
  public networkError: Error | null;

  // An object that can be used to provide some additional information
  // about an error, e.g. specifying the type of error this is. Used
  // internally within Apollo Client.
  public extraInfo: any;

  // Constructs an instance of ApolloError given a GraphQLError
  // or a network error. Note that one of these has to be a valid
  // value or the constructed error will be meaningless.
  constructor({
    graphQLErrors,
    networkError,
    errorMessage,
    extraInfo,
  }: {
    graphQLErrors?: ReadonlyArray<GraphQLError>;
    networkError?: Error | null;
    errorMessage?: string;
    extraInfo?: any;
  }) {
    super(errorMessage);
    this.graphQLErrors = graphQLErrors || [];
    this.networkError = networkError || null;

    if (!errorMessage) {
      this.message = generateErrorMessage(this);
    } else {
      this.message = errorMessage;
    }

    this.extraInfo = extraInfo;

    // We're not using `Object.setPrototypeOf` here as it isn't fully
    // supported on Android (see issue #3236).
    (this as any).__proto__ = ApolloError.prototype;
  }
}
