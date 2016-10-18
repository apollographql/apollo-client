import * as chai from 'chai';
const { assert } = chai;

import {
  mockSubscriptionNetworkInterface,
} from './mocks/mockNetworkInterface';
import ApolloClient from '../src';

// import assign = require('lodash.assign');
// import clonedeep = require('lodash.clonedeep');

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
    name => ({ result: { name: name }, delay: 10 })
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
        return { entry: { value: subscriptionData.name } };
      },
    });

    setTimeout(() => {
      sub.unsubscribe();
      assert.equal(counter, 3);
      assert.deepEqual(latestResult, { data: { entry: { value: 'Amanda Liu' } }, loading: false });
      done();
    }, 50);

    for (let i = 0; i < 2; i++) {
      networkInterface.fireResult(0); // 0 is the id of the subscription for the NI
    }
  });

  // TODO add a test that checks that subscriptions are cancelled when obs is unsubscribed from.
});
