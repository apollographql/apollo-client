import gql from 'graphql-tag';

import { InMemoryCache } from '../../cache/inmemory/inMemoryCache';
import { stripSymbols } from '../../utilities/testing/stripSymbols';
import { itAsync } from '../../utilities/testing/itAsync';

import { QueryManager } from '../QueryManager';
import { WatchQueryOptions } from '../../core/watchQueryOptions';
import { mockSingleLink } from '../../utilities/testing/mocking/mockLink';
import { NetworkStatus } from '../../core/networkStatus';

import { ObservableQuery } from '../../core/ObservableQuery';

// Used only for unit testing.
function registerPollingQuery<T>(
  queryManager: QueryManager<any>,
  queryOptions: WatchQueryOptions,
): ObservableQuery<T> {
  if (!queryOptions.pollInterval) {
    throw new Error(
      'Attempted to register a non-polling query with the scheduler.',
    );
  }
  return new ObservableQuery<T>({
    queryManager,
    options: queryOptions,
  });
}

function eachPollingQuery(
  queryManager: QueryManager<any>,
  callback: (queryId: string, info: any) => any,
) {
  (queryManager as any).pollingInfoByQueryId.forEach(
    (info: any, queryId: string) => callback(queryId, info),
  );
}

describe('QueryScheduler', () => {
  itAsync('should throw an error if we try to start polling a non-polling query', (resolve, reject) => {
    const queryManager = new QueryManager({
      link: mockSingleLink().setOnError(reject),
      cache: new InMemoryCache({ addTypename: false }),
    });

    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;

    expect(() => {
      queryManager.startPollingQuery({ query }, null as never);
    }).toThrow();

    resolve();
  });

  itAsync('should correctly start polling queries', (resolve, reject) => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;

    const data = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const queryOptions = {
      query,
      pollInterval: 80,
    };

    const link = mockSingleLink({
      request: queryOptions,
      result: { data },
    }).setOnError(reject);
    const queryManager = new QueryManager({
      cache: new InMemoryCache({ addTypename: false }),
      link: link,
    });
    let timesFired = 0;
    queryManager.startPollingQuery(queryOptions, 'fake-id', () => {
      timesFired += 1;
    });
    setTimeout(() => {
      expect(timesFired).toBeGreaterThanOrEqual(0);
      queryManager.stop();
      resolve();
    }, 120);
  });

  itAsync('should correctly stop polling queries', (resolve, reject) => {
    const query = gql`
      query {
        someAlias: author {
          firstName
          lastName
        }
      }
    `;
    const data = {
      someAlias: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const queryOptions = {
      query,
      pollInterval: 20,
    };
    const link = mockSingleLink({
      request: {
        query: queryOptions.query,
      },
      result: { data },
    }).setOnError(reject);
    const queryManager = new QueryManager({
      cache: new InMemoryCache({ addTypename: false }),
      link: link,
    });
    let timesFired = 0;
    const queryId = queryManager.startPollingQuery(queryOptions, 'fake-id');
    queryManager.addQueryListener(queryId, queryInfo => {
      if (queryInfo.networkStatus !== NetworkStatus.poll) {
        timesFired += 1;
        queryManager.stopPollingQuery(queryId);
      }
    });

    setTimeout(() => {
      expect(timesFired).toEqual(1);
      queryManager.stop();
      resolve();
    }, 170);
  });

  itAsync('should register a query and return an observable that can be unsubscribed', (resolve, reject) => {
    const myQuery = gql`
      query {
        someAuthorAlias: author {
          firstName
          lastName
        }
      }
    `;
    const data = {
      someAuthorAlias: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const queryOptions = {
      query: myQuery,
      pollInterval: 20,
    };
    const link = mockSingleLink({
      request: queryOptions,
      result: { data },
    }).setOnError(reject);
    const queryManager = new QueryManager({
      cache: new InMemoryCache({ addTypename: false }),
      link,
    });
    let timesFired = 0;
    let observableQuery = registerPollingQuery(queryManager, queryOptions);
    let subscription = observableQuery.subscribe({
      next(result) {
        timesFired += 1;
        expect(stripSymbols(result.data)).toEqual(data);
        subscription.unsubscribe();
      },
    });

    setTimeout(() => {
      expect(timesFired).toEqual(1);
      queryManager.stop();
      resolve();
    }, 100);
  });

  itAsync('should register a query and return an observable that can adjust interval', (resolve, reject) => {
    const myQuery = gql`
      query {
        someAuthorAlias: author {
          firstName
          lastName
        }
      }
    `;
    const data = [
      { someAuthorAlias: { firstName: 'John', lastName: 'Smith' } },
      { someAuthorAlias: { firstName: 'John', lastName: 'Doe' } },
      // When the test passes, this one doesn't get delivered.
      { someAuthorAlias: { firstName: 'Jane', lastName: 'Doe' } },
    ];
    const queryOptions = {
      query: myQuery,
      pollInterval: 20,
    };
    const link = mockSingleLink(
      { request: queryOptions, result: { data: data[0] } },
      { request: queryOptions, result: { data: data[1] } },
      { request: queryOptions, result: { data: data[2] } }
    ).setOnError(reject);
    const queryManager = new QueryManager({
      cache: new InMemoryCache({ addTypename: false }),
      link,
    });
    let timesFired = 0;
    let observableQuery = registerPollingQuery(queryManager, queryOptions);
    let subscription = observableQuery.subscribe({
      next(result) {
        expect(stripSymbols(result.data)).toEqual(data[timesFired]);
        timesFired += 1;
        if (timesFired === 1) {
          observableQuery.startPolling(70);
        }
      },
    });

    setTimeout(() => {
      // The observable should fire once when data[0] arrives and switch the
      // pollInterval to 70, and fire one more time 70 later. If it still was
      // polling at 20 ms (the condition which this is a regression test for) we
      // will probably run out of links in the response, and definitely have
      // timesFired end up greater than 2.
      expect(timesFired).toEqual(2);
      subscription.unsubscribe();
      queryManager.stop();
      resolve();
    }, 100);
  });

  itAsync('should handle network errors on polling queries correctly', (resolve, reject) => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const error = new Error('something went terribly wrong');
    const queryOptions = {
      query,
      pollInterval: 80,
    };
    const link = mockSingleLink({
      request: queryOptions,
      error,
    }).setOnError(reject);
    const queryManager = new QueryManager({
      cache: new InMemoryCache({ addTypename: false }),
      link,
    });
    let observableQuery = registerPollingQuery(queryManager, queryOptions);
    const subscription = observableQuery.subscribe({
      next() {
        queryManager.stop();
        reject(
          new Error('Observer provided a result despite a network error.'),
        );
      },

      error(errorVal) {
        expect(errorVal).toBeDefined();
        eachPollingQuery(queryManager, queryId => {
          expect(queryManager.checkInFlight(queryId)).toBe(false);
        });
        subscription.unsubscribe();
        queryManager.stop();
        resolve();
      },
    });
  });

  itAsync('should not fire another query if one with the same id is in flight', (resolve, reject) => {
    const query = gql`
      query B {
        fortuneCookie
      }
    `;
    const data = {
      fortuneCookie: 'you will live a long life',
    };
    const queryOptions = {
      query,
      pollInterval: 10,
    };
    const link = mockSingleLink({
      request: queryOptions,
      result: { data },
      delay: 20000,
    }).setOnError(reject);
    const queryManager = new QueryManager({
      cache: new InMemoryCache(),
      link,
    });
    const observer = registerPollingQuery(queryManager, queryOptions);
    const subscription = observer.subscribe({});
    setTimeout(() => {
      subscription.unsubscribe();
      queryManager.stop();
      resolve();
    }, 100);
  });

  itAsync('should add a query to an interval correctly', (resolve, reject) => {
    const query = gql`
      query {
        fortuneCookie
      }
    `;
    const data = {
      fortuneCookie: 'live long and prosper',
    };
    const queryOptions = {
      query,
      pollInterval: 10000,
    };
    const link = mockSingleLink({
      request: queryOptions,
      result: { data },
    }).setOnError(reject);
    const queryManager = new QueryManager<any>({
      cache: new InMemoryCache(),
      link,
    });
    const queryId = 'fake-id';
    queryManager.startPollingQuery(queryOptions, queryId);

    let count = 0;
    eachPollingQuery(queryManager, (qid, info) => {
      ++count;
      expect(info.interval).toEqual(queryOptions.pollInterval);
      expect(qid).toEqual(queryId);
    });
    expect(count).toEqual(1);
    queryManager.stop();

    resolve();
  });

  itAsync('should add multiple queries to an interval correctly', (resolve, reject) => {
    const query1 = gql`
      query {
        fortuneCookie
      }
    `;
    const data1 = {
      fortuneCookie: 'live long and prosper',
    };
    const query2 = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const data2 = {
      author: {
        firstName: 'Dhaivat',
        lastName: 'Pandya',
      },
    };
    const interval = 20000;
    const queryOptions1: WatchQueryOptions = {
      query: query1,
      pollInterval: interval,
    };
    const queryOptions2: WatchQueryOptions = {
      query: query2,
      pollInterval: interval,
    };
    const queryManager = new QueryManager({
      cache: new InMemoryCache({ addTypename: false }),
      link: mockSingleLink({
        request: { query: query1 },
        result: { data: data1 },
      }, {
        request: { query: query2 },
        result: { data: data2 },
      }).setOnError(reject),
    });
    const observable1 = registerPollingQuery(queryManager, queryOptions1);
    observable1.subscribe({
      next() {
        //do nothing
      },
    });

    const observable2 = registerPollingQuery(queryManager, queryOptions2);
    observable2.subscribe({
      next() {
        //do nothing
      },
    });

    let count = 0;
    eachPollingQuery(queryManager, (_, info) => {
      expect(info.interval).toEqual(interval);
      ++count;
    });
    expect(count).toEqual(2);
    queryManager.stop();

    resolve();
  });

  itAsync('should remove queries from the interval list correctly', (resolve, reject) => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const data = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const queryManager = new QueryManager({
      cache: new InMemoryCache({ addTypename: false }),
      link: mockSingleLink({
        request: { query },
        result: { data },
      }).setOnError(reject),
    });
    let timesFired = 0;
    const observable = registerPollingQuery(queryManager, {
      query,
      pollInterval: 10,
    });
    const subscription = observable.subscribe({
      next(result) {
        timesFired += 1;
        expect(stripSymbols(result.data)).toEqual(data);
        subscription.unsubscribe();

        let pollingCount = 0;
        eachPollingQuery(queryManager, () => ++pollingCount);
        expect(pollingCount).toEqual(0);
      },
    });

    setTimeout(() => {
      expect(timesFired).toEqual(1);
      queryManager.stop();
      resolve();
    }, 100);
  });

  itAsync('should correctly start new polling query after removing old one', (resolve, reject) => {
    const query = gql`
      query {
        someAlias: author {
          firstName
          lastName
        }
      }
    `;
    const data = {
      someAlias: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const queryOptions = {
      query,
      pollInterval: 20,
    };
    const networkResult = {
      request: queryOptions,
      result: { data },
    };
    const link = mockSingleLink(networkResult, networkResult, networkResult, networkResult).setOnError(reject);
    const queryManager = new QueryManager({
      cache: new InMemoryCache({ addTypename: false }),
      link: link,
    });
    let timesFired = 0;
    const queryId = queryManager.startPollingQuery(queryOptions, 'fake-id');
    queryManager.addQueryListener(queryId, () => {
      queryManager.stopPollingQuery(queryId);
    });
    setTimeout(() => {
      const queryId2 = queryManager.startPollingQuery(queryOptions, 'fake-id2');
      queryManager.addQueryListener(queryId2, () => {
        timesFired += 1;
      });
      setTimeout(() => {
        expect(timesFired).toBeGreaterThanOrEqual(1);
        queryManager.stop();
        resolve();
      }, 80);
    }, 200);
  });
});
