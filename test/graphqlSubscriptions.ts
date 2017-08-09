import {
  mockSubscriptionNetworkInterface,
  MockedSubscription,
} from './mocks/mockNetworkInterface';

import { assert } from 'chai';

import { cloneDeep } from 'lodash';

import { isSubscriptionResultAction } from '../src/actions';

import ApolloClient from '../src';

import gql from 'graphql-tag';

import { QueryManager } from '../src/core/QueryManager';

import { createApolloStore } from '../src/store';

import { SubscriptionOptions } from '../src/core/watchQueryOptions';

import { ApolloLink, Observable, FetchResult } from 'apollo-link-core';

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
      reduxRootSelector: (state: any) => state.apollo,
      store: createApolloStore(),
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
      reduxRootSelector: (state: any) => state.apollo,
      store: createApolloStore(),
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

  it('should receive multiple results for a subscription with Apollo Link', done => {
    let numResults = 0;
    const expectedData = [
      'Dahivat Pandya',
      'Vyacheslav Kim',
      'Changping Chen',
      'Amanda Liu',
    ].map(name => ({ user: { name: name } }));
    const queryInfo = {
      request: defaultSub1.request || ({} as any),
      results: [...expectedData],
    };

    const link = ApolloLink.from([
      operation =>
        new Observable(observer => {
          if (queryInfo.results) {
            queryInfo.results.map(result =>
              observer.next(result as FetchResult),
            );
          }
        }),
    ]);
    const client = new ApolloClient({
      networkInterface: link,
      addTypename: false,
    });

    const obs = client.subscribe(queryInfo.request as SubscriptionOptions);
    const sub = obs.subscribe({
      next: data => {
        const expected = expectedData.shift();
        if (expected) {
          assert.equal(data, expected);
        } else {
          assert(false);
        }
        if (expectedData.length === 0) {
          done();
        }
      },
      error: console.log,
      complete: () => assert(false),
    });
  });

  it('should unsubscribe properly with Apollo Link', () => {
    let numResults = 0;
    const readyToUnsub: boolean[] = [];

    const link = ApolloLink.from([
      operation =>
        new Observable(observer => {
          const index = readyToUnsub.length;
          readyToUnsub.push(false);
          return () => {
            assert(readyToUnsub[index]);
          };
        }),
    ]);
    const client = new ApolloClient({
      networkInterface: link,
      addTypename: false,
    });

    const obs0 = client.subscribe(defaultSub1.request as SubscriptionOptions);
    const obs1 = client.subscribe(defaultSub1.request as SubscriptionOptions);
    const subscription0 = obs0.subscribe({});
    const subscription1 = obs1.subscribe({});

    readyToUnsub[1] = true;
    subscription1.unsubscribe();
    readyToUnsub[0] = true;
    subscription0.unsubscribe();
    readyToUnsub.map(bool => assert(bool));
  });

  it('should fire redux action and call result reducers', done => {
    const query = gql`
      query miniQuery {
        number
      }
    `;

    const res = {
      data: {
        number: 0,
      },
    };

    const req1 = {
      request: { query },
      result: res,
    };

    const network = mockSubscriptionNetworkInterface([sub1], req1);
    let numResults = 0;
    let counter = 0;
    const queryManager = new QueryManager({
      networkInterface: network,
      reduxRootSelector: (state: any) => state.apollo,
      store: createApolloStore(),
      addTypename: false,
    });

    const observableQuery = queryManager
      .watchQuery({
        query,
        reducer: (previousResult, action) => {
          counter++;
          if (isSubscriptionResultAction(action)) {
            const newResult = cloneDeep(previousResult) as any;
            newResult.number++;
            return newResult;
          }
          return previousResult;
        },
      })
      .subscribe({
        next: () => null,
      });

    const sub = queryManager.startGraphQLSubscription(options).subscribe({
      next(result) {
        assert.deepEqual(result, results[numResults].result.data);
        numResults++;
        if (numResults === 4) {
          // once for itself, four times for the subscription results.
          observableQuery.unsubscribe();
          assert.equal(counter, 5);
          assert.equal(
            queryManager.store.getState()['apollo']['data']['ROOT_QUERY'][
              'number'
            ],
            4,
          );
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
