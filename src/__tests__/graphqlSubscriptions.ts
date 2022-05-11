import gql from 'graphql-tag';

import { ApolloClient } from '../core';
import { InMemoryCache } from '../cache';
import { QueryManager } from '../core/QueryManager';
import { itAsync, mockObservableLink } from '../testing';

describe('GraphQL Subscriptions', () => {
  const results = [
    'Dahivat Pandya',
    'Vyacheslav Kim',
    'Changping Chen',
    'Amanda Liu',
  ].map(name => ({ result: { data: { user: { name } } }, delay: 10 }));

  let options: any;
  let defaultOptions: any;
  beforeEach(() => {
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
      context: {
        someVar: 'Some value'
      }
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

  itAsync('should start a subscription on network interface and unsubscribe', (resolve, reject) => {
    const link = mockObservableLink();
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
        resolve();
      },
    });

    link.simulateResult(results[0]);
  });

  itAsync('should subscribe with default values', (resolve, reject) => {
    const link = mockObservableLink();
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

        resolve();
      },
    });

    link.simulateResult(results[0]);
  });

  itAsync('should multiplex subscriptions', (resolve, reject) => {
    const link = mockObservableLink();
    const queryManager = new QueryManager({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });

    const obs = queryManager.startGraphQLSubscription(options);

    let counter = 0;

    // tslint:disable-next-line
    obs.subscribe({
      next(result) {
        expect(result).toEqual(results[0].result);
        counter++;
        if (counter === 2) {
          resolve();
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
          resolve();
        }
      },
    }) as any;

    link.simulateResult(results[0]);
  });

  itAsync('should receive multiple results for a subscription', (resolve, reject) => {
    const link = mockObservableLink();
    let numResults = 0;
    const queryManager = new QueryManager({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });

    // tslint:disable-next-line
    queryManager.startGraphQLSubscription(options).subscribe({
      next(result) {
        expect(result).toEqual(results[numResults].result);
        numResults++;
        if (numResults === 4) {
          resolve();
        }
      },
    }) as any;

    for (let i = 0; i < 4; i++) {
      link.simulateResult(results[i]);
    }
  });

  itAsync('should not cache subscription data if a `no-cache` fetch policy is used', (resolve, reject) => {
    const link = mockObservableLink();
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
        resolve();
      },
    });

    link.simulateResult(results[0]);
  });

  it('should throw an error if the result has errors on it', () => {
    const link = mockObservableLink();
    const queryManager = new QueryManager({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });

    const obs = queryManager.startGraphQLSubscription(options);

    const promises = [];
    for (let i = 0; i < 2; i += 1) {
      promises.push(
        new Promise<void>((resolve, reject) => {
          obs.subscribe({
            next(result) {
              reject('Should have hit the error block');
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
          } as any,
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

    return new Promise<void>(resolve => {
      client.subscribe(defaultOptions).subscribe({
        complete() {
          resolve();
        },
      });
      setTimeout(() => link.simulateComplete(), 100);
    });
  });

  itAsync('should pass a context object through the link execution chain', (resolve, reject) => {
    const link = mockObservableLink();
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    client.subscribe(options).subscribe({
      next() {
        expect(link.operation.getContext().someVar).toEqual(
          options.context.someVar
        );
        resolve();
      },
    });

    link.simulateResult(results[0]);
  });
});
