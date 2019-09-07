import gql from 'graphql-tag';
import { InMemoryCache } from 'apollo-cache-inmemory';

import { mockObservableLink, MockedSubscription } from '../__mocks__/mockLinks';

import ApolloClient from '../';

import { QueryManager } from '../core/QueryManager';
import { DataStore } from '../data/store';

describe('GraphQL Subscriptions', () => {
  const results = [
    'Dahivat Pandya',
    'Vyacheslav Kim',
    'Changping Chen',
    'Amanda Liu',
  ].map(name => ({ result: { data: { user: { name } } }, delay: 10 }));

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
    const link = mockObservableLink(defaultSub1);
    // This test calls directly through Apollo Client
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });

    let count = 0;
    const sub = client.subscribe(defaultOptions).subscribe({
      next(result) {
        count++;
        expect(result).toEqual(results[0].result);

        // Test unsubscribing
        if (count > 1) {
          throw new Error('next fired after unsubscribing');
        }
        sub.unsubscribe();
        done();
      },
    });

    link.simulateResult(results[0]);
  });

  it('should subscribe with default values', done => {
    const link = mockObservableLink(sub1);
    // This test calls directly through Apollo Client
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });

    let count = 0;
    const sub = client.subscribe(options).subscribe({
      next(result) {
        expect(result).toEqual(results[0].result);

        // Test unsubscribing
        if (count > 1) {
          throw new Error('next fired after unsubscribing');
        }
        sub.unsubscribe();

        done();
      },
    });

    link.simulateResult(results[0]);
  });

  it('should multiplex subscriptions', done => {
    const link = mockObservableLink(sub1);
    const queryManager = new QueryManager({
      link,
      store: new DataStore(new InMemoryCache({ addTypename: false })),
    });

    const obs = queryManager.startGraphQLSubscription(options);

    let counter = 0;

    // tslint:disable-next-line
    obs.subscribe({
      next(result) {
        expect(result).toEqual(results[0].result);
        counter++;
        if (counter === 2) {
          done();
        }
      },
    }) as any;

    // Subscribe again. Should also receive the same result.
    // tslint:disable-next-line
    obs.subscribe({
      next(result) {
        expect(result).toEqual(results[0].result);
        counter++;
        if (counter === 2) {
          done();
        }
      },
    }) as any;

    link.simulateResult(results[0]);
  });

  it('should receive multiple results for a subscription', done => {
    const link = mockObservableLink(sub1);
    let numResults = 0;
    const queryManager = new QueryManager({
      link,
      store: new DataStore(new InMemoryCache({ addTypename: false })),
    });

    // tslint:disable-next-line
    queryManager.startGraphQLSubscription(options).subscribe({
      next(result) {
        expect(result).toEqual(results[numResults].result);
        numResults++;
        if (numResults === 4) {
          done();
        }
      },
    }) as any;

    for (let i = 0; i < 4; i++) {
      link.simulateResult(results[i]);
    }
  });

  it('should not cache subscription data if a `no-cache` fetch policy is used', done => {
    const link = mockObservableLink(sub1);
    const cache = new InMemoryCache({ addTypename: false });
    const client = new ApolloClient({
      link,
      cache,
    });

    expect(cache.extract()).toEqual({});

    options.fetchPolicy = 'no-cache';
    const sub = client.subscribe(options).subscribe({
      next() {
        expect(cache.extract()).toEqual({});
        sub.unsubscribe();
        done();
      },
    });

    link.simulateResult(results[0]);
  });

  it('should throw an error if the result has errors on it', () => {
    const link = mockObservableLink(sub1);
    const queryManager = new QueryManager({
      link,
      store: new DataStore(new InMemoryCache({ addTypename: false })),
    });

    const obs = queryManager.startGraphQLSubscription(options);

    const promises = [];
    for (let i = 0; i < 2; i += 1) {
      promises.push(
        new Promise((resolve, reject) => {
          obs.subscribe({
            next(result) {
              fail('Should have hit the error block');
              reject();
            },
            error(error) {
              expect(error).toMatchSnapshot();
              resolve();
            },
          });
        }),
      );
    }

    const errorResult = {
      result: {
        data: null,
        errors: [
          {
            message: 'This is an error',
            locations: [
              {
                column: 3,
                line: 2,
              },
            ],
            path: ['result'],
          },
        ],
      },
    };

    link.simulateResult(errorResult);
    return Promise.all(promises);
  });

  it('should call complete handler when the subscription completes', () => {
    const link = mockObservableLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });

    return new Promise(resolve => {
      client.subscribe(defaultOptions).subscribe({
        complete() {
          resolve();
        },
      });
      setTimeout(() => link.simulateComplete(), 100);
    });
  });
});
