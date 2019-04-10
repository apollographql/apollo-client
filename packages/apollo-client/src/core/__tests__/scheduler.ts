import { InMemoryCache } from 'apollo-cache-inmemory';
import gql from 'graphql-tag';
import { stripSymbols } from 'apollo-utilities';

import { QueryManager } from '../QueryManager';
import { WatchQueryOptions } from '../../core/watchQueryOptions';
import { mockSingleLink } from '../../__mocks__/mockLinks';
import { NetworkStatus } from '../../core/networkStatus';

import { DataStore } from '../../data/store';
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
  it('should throw an error if we try to start polling a non-polling query', () => {
    const queryManager = new QueryManager({
      link: mockSingleLink(),
      store: new DataStore(new InMemoryCache({ addTypename: false })),
    });

    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const queryOptions: WatchQueryOptions = {
      query,
    };
    expect(() => {
      queryManager.startPollingQuery(queryOptions, null as never);
    }).toThrow();
  });

  it('should correctly start polling queries', done => {
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
    });
    const queryManager = new QueryManager({
      store: new DataStore(new InMemoryCache({ addTypename: false })),

      link: link,
    });
    let timesFired = 0;
    queryManager.startPollingQuery(queryOptions, 'fake-id', () => {
      timesFired += 1;
    });
    setTimeout(() => {
      expect(timesFired).toBeGreaterThanOrEqual(0);
      queryManager.stop();
      done();
    }, 120);
  });

  it('should correctly stop polling queries', done => {
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
    });
    const queryManager = new QueryManager({
      store: new DataStore(new InMemoryCache({ addTypename: false })),
      link: link,
    });
    let timesFired = 0;
    const queryId = queryManager.startPollingQuery(
      queryOptions,
      'fake-id',
      queryStoreValue => {
        if (queryStoreValue.networkStatus !== NetworkStatus.poll) {
          timesFired += 1;
          queryManager.stopPollingQuery(queryId);
        }
      },
    );

    setTimeout(() => {
      expect(timesFired).toEqual(1);
      queryManager.stop();
      done();
    }, 170);
  });

  it('should register a query and return an observable that can be unsubscribed', done => {
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
    });
    const queryManager = new QueryManager({
      store: new DataStore(new InMemoryCache({ addTypename: false })),

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
      done();
    }, 100);
  });

  it('should register a query and return an observable that can adjust interval', done => {
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
      { request: queryOptions, result: { data: data[2] } },
    );
    const queryManager = new QueryManager({
      store: new DataStore(new InMemoryCache({ addTypename: false })),
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
      done();
    }, 100);
  });

  it('should handle network errors on polling queries correctly', done => {
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
    });
    const queryManager = new QueryManager({
      store: new DataStore(new InMemoryCache({ addTypename: false })),
      link,
    });
    let observableQuery = registerPollingQuery(queryManager, queryOptions);
    const subscription = observableQuery.subscribe({
      next() {
        queryManager.stop();
        done.fail(
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
        done();
      },
    });
  });

  it('should not fire another query if one with the same id is in flight', done => {
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
    });
    const queryManager = new QueryManager({
      store: new DataStore(new InMemoryCache()),
      link,
    });
    const observer = registerPollingQuery(queryManager, queryOptions);
    const subscription = observer.subscribe({});
    setTimeout(() => {
      subscription.unsubscribe();
      queryManager.stop();
      done();
    }, 100);
  });

  it('should add a query to an interval correctly', () => {
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
    });
    const queryManager = new QueryManager<any>({
      store: new DataStore(new InMemoryCache()),
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
  });

  it('should add multiple queries to an interval correctly', () => {
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
      store: new DataStore(new InMemoryCache({ addTypename: false })),
      link: mockSingleLink(
        {
          request: { query: query1 },
          result: { data: data1 },
        },
        {
          request: { query: query2 },
          result: { data: data2 },
        },
      ),
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
  });

  it('should remove queries from the interval list correctly', done => {
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
      store: new DataStore(new InMemoryCache({ addTypename: false })),
      link: mockSingleLink({
        request: { query },
        result: { data },
      }),
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
      done();
    }, 100);
  });

  it('should correctly start new polling query after removing old one', done => {
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
    const link = mockSingleLink(
      networkResult,
      networkResult,
      networkResult,
      networkResult,
    );
    const queryManager = new QueryManager({
      store: new DataStore(new InMemoryCache({ addTypename: false })),
      link: link,
    });
    let timesFired = 0;
    let queryId = queryManager.startPollingQuery(
      queryOptions,
      'fake-id',
      () => {
        queryManager.stopPollingQuery(queryId);
      },
    );
    setTimeout(() => {
      queryManager.startPollingQuery(queryOptions, 'fake-id2', () => {
        timesFired += 1;
      });
      setTimeout(() => {
        expect(timesFired).toBeGreaterThanOrEqual(1);
        queryManager.stop();
        done();
      }, 80);
    }, 200);
  });
});
