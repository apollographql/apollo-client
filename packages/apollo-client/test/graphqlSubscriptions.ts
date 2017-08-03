import {
  mockSubscriptionNetworkInterface,
  MockedSubscription,
} from './mocks/mockNetworkInterface';

import { assert } from 'chai';

import { cloneDeep } from 'lodash';

import ApolloClient from '../src';

import gql from 'graphql-tag';

import { QueryManager } from '../src/core/QueryManager';

import { InMemoryCache } from '../src/data/inMemoryCache';

describe('GraphQL Subscriptions', () => {
  const results = [
    'Dahivat Pandya',
    'Vyacheslav Kim',
    'Changping Chen',
    'Amanda Liu',
  ].map(name => ({ result: { data: { user: { name: name } } }, delay: 10 }));

  let sub1: MockedSubscription;
  let options: any;
  let defaultOptions: any;
  let defaultSub1: MockedSubscription;
  beforeEach(() => {
    sub1 = {
      request: {
        query: gql`
          subscription UserInfo($name: String) {
            user(name: $name) {
              name
            }
          }
        `,
        variables: {
          name: 'Changping Chen',
        },
      },
      id: 0,
      results: [...results],
    };

    options = {
      query: gql`
        subscription UserInfo($name: String) {
          user(name: $name) {
            name
          }
        }
      `,
      variables: {
        name: 'Changping Chen',
      },
    };

    defaultSub1 = {
      request: {
        query: gql`
          subscription UserInfo($name: String = "Changping Chen") {
            user(name: $name) {
              name
            }
          }
        `,
        variables: {
          name: 'Changping Chen',
        },
      },
      id: 0,
      results: [...results],
    };

    defaultOptions = {
      query: gql`
        subscription UserInfo($name: String = "Changping Chen") {
          user(name: $name) {
            name
          }
        }
      `,
    };
  });

  it('should start a subscription on network interface and unsubscribe', done => {
    const network = mockSubscriptionNetworkInterface([defaultSub1]);
    // This test calls directly through Apollo Client
    const client = new ApolloClient({
      networkInterface: network,
      addTypename: false,
    });

    const sub = client.subscribe(defaultOptions).subscribe({
      next(result) {
        assert.deepEqual(result, results[0].result.data);

        // Test unsubscribing
        sub.unsubscribe();
        assert.equal(Object.keys(network.mockedSubscriptionsById).length, 0);

        done();
      },
    });

    const id = (sub as any)._networkSubscriptionId;
    network.fireResult(id);

    assert.equal(Object.keys(network.mockedSubscriptionsById).length, 1);
  });

  it('should subscribe with default values', done => {
    const network = mockSubscriptionNetworkInterface([sub1]);
    // This test calls directly through Apollo Client
    const client = new ApolloClient({
      networkInterface: network,
      addTypename: false,
    });

    const sub = client.subscribe(options).subscribe({
      next(result) {
        assert.deepEqual(result, results[0].result.data);

        // Test unsubscribing
        sub.unsubscribe();
        assert.equal(Object.keys(network.mockedSubscriptionsById).length, 0);

        done();
      },
    });

    const id = (sub as any)._networkSubscriptionId;
    network.fireResult(id);

    assert.equal(Object.keys(network.mockedSubscriptionsById).length, 1);
  });

  it('should multiplex subscriptions', done => {
    const network = mockSubscriptionNetworkInterface([sub1]);
    const queryManager = new QueryManager({
      networkInterface: network,
      addTypename: false,
    });

    const obs = queryManager.startGraphQLSubscription(options);

    let counter = 0;

    const sub = obs.subscribe({
      next(result) {
        assert.deepEqual(result, results[0].result.data);
        counter++;
        if (counter === 2) {
          done();
        }
      },
    }) as any;

    // Subscribe again. Should also receive the same result.
    const resub = obs.subscribe({
      next(result) {
        assert.deepEqual(result, results[0].result.data);
        counter++;
        if (counter === 2) {
          done();
        }
      },
    }) as any;

    const id = sub._networkSubscriptionId;
    network.fireResult(id);
  });

  it('should receive multiple results for a subscription', done => {
    const network = mockSubscriptionNetworkInterface([sub1]);
    let numResults = 0;
    const queryManager = new QueryManager({
      networkInterface: network,
      addTypename: false,
    });

    const sub = queryManager.startGraphQLSubscription(options).subscribe({
      next(result) {
        assert.deepEqual(result, results[numResults].result.data);
        numResults++;
        if (numResults === 4) {
          done();
        }
      },
    }) as any;

    const id = sub._networkSubscriptionId;

    for (let i = 0; i < 4; i++) {
      network.fireResult(id);
    }
  });
});
