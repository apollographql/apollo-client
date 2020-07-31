import { ApolloError } from '..';
import { GraphQLError } from 'graphql';

describe('ApolloError', () => {
  it('should construct itself correctly', () => {
    const graphQLErrors = [
      new GraphQLError('Something went wrong with GraphQL'),
      new GraphQLError('Something else went wrong with GraphQL'),
    ];
    const networkError = new Error('Network error');
    const errorMessage = 'this is an error message';
    const apolloError = new ApolloError({
      graphQLErrors: graphQLErrors,
      networkError: networkError,
      errorMessage: errorMessage,
    });
    expect(apolloError.graphQLErrors).toEqual(graphQLErrors);
    expect(apolloError.networkError).toEqual(networkError);
    expect(apolloError.message).toBe(errorMessage);
  });

  it('should add a network error to the message', () => {
    const networkError = new Error('this is an error message');
    const apolloError = new ApolloError({
      networkError,
    });
    expect(apolloError.message).toMatch('this is an error message');
    expect(apolloError.message.split('\n').length).toBe(1);
  });

  it('should add a graphql error to the message', () => {
    const graphQLErrors = [new GraphQLError('this is an error message')];
    const apolloError = new ApolloError({
      graphQLErrors,
    });
    expect(apolloError.message).toMatch('this is an error message');
    expect(apolloError.message.split('\n').length).toBe(1);
  });

  it('should add multiple graphql errors to the message', () => {
    const graphQLErrors = [new GraphQLError('this is new'), new GraphQLError('this is old')];
    const apolloError = new ApolloError({
      graphQLErrors,
    });
    const messages = apolloError.message.split('\n');
    expect(messages.length).toBe(2);
    expect(messages[0]).toMatch('this is new');
    expect(messages[1]).toMatch('this is old');
  });

  it('should add both network and graphql errors to the message', () => {
    const graphQLErrors = [new GraphQLError('graphql error message')];
    const networkError = new Error('network error message');
    const apolloError = new ApolloError({
      graphQLErrors,
      networkError,
    });
    const messages = apolloError.message.split('\n');
    expect(messages.length).toBe(2);
    expect(messages[0]).toMatch('graphql error message');
    expect(messages[1]).toMatch('network error message');
  });

  it('should contain a stack trace', () => {
    const graphQLErrors = [new GraphQLError('graphql error message')];
    const networkError = new Error('network error message');
    const apolloError = new ApolloError({
      graphQLErrors,
      networkError,
    });
    expect(apolloError.stack).toBeDefined();
  });
});
