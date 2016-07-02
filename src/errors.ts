import { GraphQLError } from 'graphql';

export class ApolloError extends Error {
  public message: string;
  public graphQLErrors: GraphQLError[];
  public networkError: Error;

  // Constructs an instance of ApolloError given a GraphQLError
  // or a network error. Note that one of these has to be a valid
  // value or the constructed error will be meaningless.
  constructor({
    graphQLErrors,
    networkError,
    errorMessage,
  }: {
    graphQLErrors?: GraphQLError[],
    networkError?: Error,
    errorMessage?: string,
  }) {
    super(errorMessage);
    this.graphQLErrors = graphQLErrors;
    this.networkError = networkError;

    this.generateErrorMessage();
  }

  // Sets the error message on this error according to the
  // the GraphQL and network errors that are present.
  // If the error message has already been set through the
  // constructor or otherwise, this function is a nop.
  private generateErrorMessage() {
    if (typeof this.message !== 'undefined' &&
       this.message !== '') {
      return;
    }

    let message = '';
    // If we have GraphQL errors present, add that to the error message.
    if (Array.isArray(this.graphQLErrors) && this.graphQLErrors.length !== 0) {
      this.graphQLErrors.forEach((graphQLError) => {
        message += graphQLError.message + '\n';
      });
    }

    if (this.networkError) {
      message += this.networkError.message + '\n';
    }

    // strip newline from the end of the message
    message = message.replace(/\n$/, '');
    this.message = message;
  }
}
