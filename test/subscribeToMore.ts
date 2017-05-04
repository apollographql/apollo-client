import * as chai from 'chai';
const { assert } = chai;

import {
  mockSubscriptionNetworkInterface,
} from './mocks/mockNetworkInterface';

import ApolloClient from '../src';

import gql from 'graphql-tag';

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

  const results = ['Dahivat Pandya', 'Amanda Liu'].map(
    name => ({ result: { name: name }, delay: 10 }),
  );

  const sub1 = {
    request: {
      query: gql`
        subscription newValues {
          name
        }
      `,
    },
    id: 0,
    results: [...results],
  };

  const results2 = [
    { error: new Error('You cant touch this'), delay: 10 },
    { result: { name: 'Amanda Liu' }, delay: 10 },
  ];

  const sub2 = {
    request: {
      query: gql`
        subscription newValues {
          name
        }
      `,
    },
    id: 0,
    results: [...results2],
  };

  const results3 = [
    { error: new Error('You cant touch this'), delay: 10 },
    { result: { name: 'Amanda Liu' }, delay: 10 },
  ];

  const sub3 = {
    request: {
      query: gql`
        subscription newValues {
          name
        }
      `,
    },
    id: 0,
    results: [...results3],
  };

  const results4 = ['Vyacheslav Kim', 'Changping Chen'].map(
    name => ({ result: { name: name }, delay: 10 }),
  );

  const sub4 = {
    request: {
      query: gql`
        subscription newValues {
          name
        }
      `,
    },
    id: 0,
    results: [...results4],
  };

  it('triggers new result from subscription data', (done) => {
    let latestResult: any = null;
    const networkInterface = mockSubscriptionNetworkInterface([sub1], req1);
    let counter = 0;

    const client = new ApolloClient({
      networkInterface,
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
      assert.deepEqual(
        latestResult,
        { data: { entry: { value: 'Amanda Liu' } }, loading: false, networkStatus: 7, stale: false },
      );
      done();
    }, 50);

    for (let i = 0; i < 2; i++) {
      networkInterface.fireResult(0); // 0 is the id of the subscription for the NI
    }
  });


  it('calls error callback on error', (done) => {
    let latestResult: any = null;
    const networkInterface = mockSubscriptionNetworkInterface([sub2], req1);
    let counter = 0;

    const client = new ApolloClient({
      networkInterface,
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
      onError: (err) => { errorCount += 1; },
    });

    setTimeout(() => {
      sub.unsubscribe();
      assert.equal(counter, 2);
      assert.deepEqual(
        latestResult,
        { data: { entry: { value: 'Amanda Liu' } }, loading: false, networkStatus: 7, stale: false },
      );
      assert.equal(errorCount, 1);
      done();
    }, 50);

    for (let i = 0; i < 2; i++) {
      networkInterface.fireResult(0); // 0 is the id of the subscription for the NI
    }
  });

  it('prints unhandled subscription errors to the console', (done) => {
    let latestResult: any = null;
    const networkInterface = mockSubscriptionNetworkInterface([sub3], req1);
    let counter = 0;

    const client = new ApolloClient({
      networkInterface,
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
    console.error = (err: Error) => { errorCount += 1; };

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
      assert.equal(counter, 2);
      assert.deepEqual(
        latestResult,
        { data: { entry: { value: 'Amanda Liu' } }, loading: false, networkStatus: 7, stale: false },
      );
      assert.equal(errorCount, 1);
      console.error = consoleErr;
      done();
    }, 50);

    for (let i = 0; i < 2; i++) {
      networkInterface.fireResult(0); // 0 is the id of the subscription for the NI
    }
  });

  it('updates new result from subscription via a reducer in watchQuery options', (done) => {
    let latestResult: any = null;
    const networkInterface = mockSubscriptionNetworkInterface([sub4], req1);
    let counter = 0;

    const client = new ApolloClient({
      networkInterface,
      addTypename: false,
    });

    const obsHandle = client.watchQuery({
      query,
      reducer: (previousResult, action) => {
        if (action.type === 'APOLLO_SUBSCRIPTION_RESULT' && action.operationName === 'newValues') {
          if (action.result.data) {
            return { entry: { value: action.result.data.name } };
          }
        }
        return previousResult;
      },
    });
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
    });

    setTimeout(() => {
      sub.unsubscribe();
      assert.equal(counter, 3);
      assert.deepEqual(
        latestResult,
        { data: { entry: { value: 'Changping Chen' } }, loading: false, networkStatus: 7, stale: false },
      );
      done();
    }, 50);

    for (let i = 0; i < 2; i++) {
      networkInterface.fireResult(0); // 0 is the id of the subscription for the NI
    }
  });
  // TODO add a test that checks that subscriptions are cancelled when obs is unsubscribed from.
});
