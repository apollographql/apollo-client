import * as chai from 'chai';
const { assert } = chai;

import {
  mockSingleLink,
  mockObservableLink,
  MockedSubscription,
} from './mocks/mockLinks';

import ApolloClient from '../src';

import gql from 'graphql-tag';

import { DocumentNode, OperationDefinitionNode } from 'graphql';

import { ApolloLink, Operation } from 'apollo-link-core';

const isSub = (operation: Operation) =>
  (operation.query as DocumentNode).definitions
    .filter(x => x.kind === 'OperationDefinition')
    .some((x: OperationDefinitionNode) => x.operation === 'subscription');

describe('subscribeToMore', () => {
  const query = gql`
    query aQuery {
      entry {
        value
      }
    }
  `;
  const result = {
    data: {
      entry: {
        value: 1,
      },
    },
  };

  const req1 = { request: { query }, result };

  const results = ['Dahivat Pandya', 'Amanda Liu'].map(name => ({
    result: { data: { name } },
    delay: 10,
  }));

  const sub1 = {
    request: {
      query: gql`
        subscription newValues {
          name
        }
      `,
    },
  };

  const results2 = [
    { result: { data: { name: 'Amanda Liu' } }, delay: 10 },
    { error: new Error('You cant touch this'), delay: 10 },
  ];

  const sub2 = {
    request: {
      query: gql`
        subscription newValues {
          name
        }
      `,
    },
  };

  const results3 = [
    { error: new Error('You cant touch this'), delay: 10 },
    { result: { data: { name: 'Amanda Liu' } }, delay: 10 },
  ];

  const sub3 = {
    request: {
      query: gql`
        subscription newValues {
          name
        }
      `,
    },
  };

  it('triggers new result from subscription data', done => {
    let latestResult: any = null;
    const wSLink = mockObservableLink(sub1);
    const httpLink = mockSingleLink(req1);

    const link = ApolloLink.split(isSub, wSLink, httpLink);
    let counter = 0;

    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    const obsHandle = client.watchQuery({ query });

    const sub = obsHandle.subscribe({
      next(queryResult) {
        latestResult = queryResult;
        counter++;
      },
    });

    obsHandle.subscribeToMore({
      document: gql`
        subscription newValues {
          name
        }
      `,
      updateQuery: (prev, { subscriptionData }) => {
        return { entry: { value: subscriptionData.data.name } };
      },
    });

    setTimeout(() => {
      sub.unsubscribe();
      assert.equal(counter, 3);
      assert.deepEqual(latestResult, {
        data: { entry: { value: 'Amanda Liu' } },
        loading: false,
        networkStatus: 7,
        stale: false,
      });
      done();
    }, 50);

    for (let i = 0; i < 2; i++) {
      wSLink.simulateResult(results[i]);
    }
  });

  it('calls error callback on error', done => {
    let latestResult: any = null;
    const wSLink = mockObservableLink(sub2);
    const httpLink = mockSingleLink(req1);

    const link = ApolloLink.split(isSub, wSLink, httpLink);

    let counter = 0;

    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    const obsHandle = client.watchQuery({
      query,
    });
    const sub = obsHandle.subscribe({
      next(queryResult) {
        latestResult = queryResult;
        counter++;
      },
    });

    let errorCount = 0;

    obsHandle.subscribeToMore({
      document: gql`
        subscription newValues {
          name
        }
      `,
      updateQuery: (prev, { subscriptionData }) => {
        return { entry: { value: subscriptionData.data.name } };
      },
      onError: err => {
        errorCount += 1;
      },
    });

    setTimeout(() => {
      sub.unsubscribe();
      assert.deepEqual(latestResult, {
        data: { entry: { value: 'Amanda Liu' } },
        loading: false,
        networkStatus: 7,
        stale: false,
      });
      assert.equal(counter, 2);
      assert.equal(errorCount, 1);
      done();
    }, 50);

    for (let i = 0; i < 2; i++) {
      wSLink.simulateResult(results2[i]);
    }
  });

  it('prints unhandled subscription errors to the console', done => {
    let latestResult: any = null;

    const wSLink = mockObservableLink(sub3);
    const httpLink = mockSingleLink(req1);

    const link = ApolloLink.split(isSub, wSLink, httpLink);

    let counter = 0;

    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    const obsHandle = client.watchQuery({
      query,
    });
    const sub = obsHandle.subscribe({
      next(queryResult) {
        latestResult = queryResult;
        counter++;
      },
    });

    let errorCount = 0;
    const consoleErr = console.error;
    console.error = (err: Error) => {
      errorCount += 1;
    };

    obsHandle.subscribeToMore({
      document: gql`
        subscription newValues {
          name
        }
      `,
      updateQuery: (prev, { subscriptionData }) => {
        throw new Error('should not be called because of initial error');
      },
    });

    setTimeout(() => {
      sub.unsubscribe();
      assert.deepEqual(latestResult, {
        data: { entry: { value: 1 } },
        loading: false,
        networkStatus: 7,
        stale: false,
      });
      assert.equal(counter, 1);
      assert.equal(errorCount, 1);
      console.error = consoleErr;
      done();
    }, 50);

    for (let i = 0; i < 2; i++) {
      wSLink.simulateResult(results3[i]);
    }
  });
  // TODO add a test that checks that subscriptions are cancelled when obs is unsubscribed from.
});
