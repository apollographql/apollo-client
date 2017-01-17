import { assert } from 'chai';
import { ApolloError } from '../src/errors/ApolloError';
import HttpNetworkError from '../src/errors/HttpNetworkError';

import { createFakeIResponse } from './mocks/mockFetch';

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

describe('HttpNetworkError', () => {
  it('should provide the given response back to the user', () => {
    const response = createFakeIResponse('http://fake.url', 403, 'Unauthorized');

    const err = new HttpNetworkError({ response });

    assert.deepEqual(err.response, response);
  });

  it('should provide default values for the request and message', () => {
    const response = createFakeIResponse('http://fake.url', 403, 'Unauthorized');
    const err = new HttpNetworkError({ response });

    assert.isOk(err.message);
    assert.isObject(err.request);
  });

  it('should accept a request and message if provided', () => {
    const response = createFakeIResponse('http://fake.url', 403, 'Unauthorized');
    const request = { name: 'Sample Request' };
    const message = 'a test message';
    const err = new HttpNetworkError({ response, request, message });

    assert.equal(err.message, message);
    assert.deepEqual(err.request, request);
  });
});
