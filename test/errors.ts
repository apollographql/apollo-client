import { assert } from 'chai';
import { ApolloError } from '../src/errors/ApolloError';

import { createMockedIResponse } from './mocks/mockFetch';

describe('ApolloError', () => {
  it('should construct itself correctly', () => {
    const graphQLErrors = [
      new Error('Something went wrong with GraphQL'),
      new Error('Something else went wrong with GraphQL'),
    ];
    const networkError = new Error('Network error');
    const errorMessage = 'this is an error message';
    const apolloError = new ApolloError({
      graphQLErrors: graphQLErrors,
      networkError: networkError,
      errorMessage: errorMessage,
    });
    assert.equal(apolloError.graphQLErrors, graphQLErrors);
    assert.equal(apolloError.networkError, networkError);
    assert.equal(apolloError.message, errorMessage);
  });

  it('should add a network error to the message', () => {
    const networkError = new Error('this is an error message');
    const apolloError = new ApolloError({
      networkError,
    });
    assert.include(apolloError.message, 'Network error: ');
    assert.include(apolloError.message, 'this is an error message');
    assert.equal(apolloError.message.split('\n').length, 1);
  });

  it('should add a graphql error to the message', () => {
    const graphQLErrors = [ new Error('this is an error message') ];
    const apolloError = new ApolloError({
      graphQLErrors,
    });
    assert.include(apolloError.message, 'GraphQL error: ');
    assert.include(apolloError.message, 'this is an error message');
    assert.equal(apolloError.message.split('\n').length, 1);
  });

  it('should add multiple graphql errors to the message', () => {
    const graphQLErrors = [ new Error('this is new'),
                            new Error('this is old'),
                          ];
    const apolloError = new ApolloError({
      graphQLErrors,
    });
    const messages = apolloError.message.split('\n');
    assert.equal(messages.length, 2);
    assert.include(messages[0], 'GraphQL error');
    assert.include(messages[0], 'this is new');
    assert.include(messages[1], 'GraphQL error');
    assert.include(messages[1], 'this is old');
  });

  it('should add both network and graphql errors to the message', () => {
    const graphQLErrors = [ new Error('graphql error message') ];
    const networkError = new Error('network error message');
    const apolloError = new ApolloError({
      graphQLErrors,
      networkError,
    });
    const messages = apolloError.message.split('\n');
    assert.equal(messages.length, 2);
    assert.include(messages[0], 'GraphQL error');
    assert.include(messages[0], 'graphql error message');
    assert.include(messages[1], 'Network error');
    assert.include(messages[1], 'network error message');
  });

  it('should contain a stack trace', () => {
    const graphQLErrors = [ new Error('graphql error message') ];
    const networkError = new Error('network error message');
    const apolloError = new ApolloError({
      graphQLErrors,
      networkError,
    });
    assert(apolloError.stack, 'Does not contain a stack trace.');
  });
});
