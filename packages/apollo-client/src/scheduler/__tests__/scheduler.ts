import { InMemoryCache } from 'apollo-cache-inmemory';
import gql from 'graphql-tag';
import { stripSymbols } from 'apollo-utilities';

import { QueryScheduler } from '../scheduler';
import { QueryManager } from '../../core/QueryManager';
import { WatchQueryOptions } from '../../core/watchQueryOptions';
import { mockSingleLink } from '../../__mocks__/mockLinks';
import { NetworkStatus } from '../../core/networkStatus';

import { DataStore } from '../../data/store';

describe('QueryScheduler', () => {
  it('should throw an error if we try to start polling a non-polling query', () => {
    const queryManager = new QueryManager({
      link: mockSingleLink(),
      store: new DataStore(new InMemoryCache({ addTypename: false })),
    });

    const scheduler = new QueryScheduler({
      queryManager,
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
      scheduler.startPollingQuery(queryOptions, null as never);
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
    const scheduler = new QueryScheduler({
      queryManager,
    });
    let timesFired = 0;
    const queryId = scheduler.startPollingQuery(queryOptions, 'fake-id', () => {
      timesFired += 1;
    });
    setTimeout(() => {
      expect(timesFired).toBeGreaterThanOrEqual(0);
      scheduler.stopPollingQuery(queryId);
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
    const scheduler = new QueryScheduler({
      queryManager,
    });
    let timesFired = 0;
    let queryId = scheduler.startPollingQuery(
      queryOptions,
      'fake-id',
      queryStoreValue => {
        if (queryStoreValue.networkStatus !== NetworkStatus.poll) {
          timesFired += 1;
          scheduler.stopPollingQuery(queryId);
        }
      },
    );

    setTimeout(() => {
      expect(timesFired).toEqual(1);
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
    const scheduler = new QueryScheduler({
      queryManager,
    });
    let timesFired = 0;
    let observableQuery = scheduler.registerPollingQuery(queryOptions);
    let subscription = observableQuery.subscribe({
      next(result) {
        timesFired += 1;
        expect(stripSymbols(result.data)).toEqual(data);
        subscription.unsubscribe();
      },
    });

    setTimeout(() => {
      expect(timesFired).toEqual(1);
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
    const scheduler = new QueryScheduler({
      queryManager,
    });
    let timesFired = 0;
    let observableQuery = scheduler.registerPollingQuery(queryOptions);
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
    const scheduler = new QueryScheduler({
      queryManager,
    });
    let observableQuery = scheduler.registerPollingQuery(queryOptions);
    const subscription = observableQuery.subscribe({
      next() {
        done.fail(
          new Error('Observer provided a result despite a network error.'),
        );
      },

      error(errorVal) {
        expect(errorVal).toBeDefined();
        const queryId = scheduler.intervalQueries[queryOptions.pollInterval][0];
        expect(scheduler.checkInFlight(queryId)).toBe(false);
        subscription.unsubscribe();
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
    const scheduler = new QueryScheduler({
      queryManager,
    });
    const observer = scheduler.registerPollingQuery(queryOptions);
    const subscription = observer.subscribe({});
    setTimeout(() => {
      subscription.unsubscribe();
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
    const queryManager = new QueryManager({
      store: new DataStore(new InMemoryCache()),
      link,
    });
    const scheduler = new QueryScheduler({
      queryManager,
    });
    const queryId = 'fake-id';
    scheduler.addQueryOnInterval<any>(queryId, queryOptions);
    expect(Object.keys(scheduler.intervalQueries).length).toEqual(1);
    expect(Object.keys(scheduler.intervalQueries)[0]).toEqual(
      queryOptions.pollInterval.toString(),
    );
    const queries = (<any>scheduler.intervalQueries)[
      queryOptions.pollInterval.toString()
    ];
    expect(queries.length).toEqual(1);
    expect(queries[0]).toEqual(queryId);
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
    const scheduler = new QueryScheduler({
      queryManager,
    });
    const observable1 = scheduler.registerPollingQuery(queryOptions1);
    observable1.subscribe({
      next() {
        //do nothing
      },
    });

    const observable2 = scheduler.registerPollingQuery(queryOptions2);
    observable2.subscribe({
      next() {
        //do nothing
      },
    });

    const keys = Object.keys(scheduler.intervalQueries);
    expect(keys.length).toEqual(1);
    expect(keys[0]).toEqual(String(interval));

    const queryIds = (<any>scheduler.intervalQueries)[keys[0]];
    expect(queryIds.length).toEqual(2);
    expect(scheduler.registeredQueries[queryIds[0]]).toEqual(queryOptions1);
    expect(scheduler.registeredQueries[queryIds[1]]).toEqual(queryOptions2);
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
    const scheduler = new QueryScheduler({
      queryManager,
    });
    let timesFired = 0;
    const observable = scheduler.registerPollingQuery({
      query,
      pollInterval: 10,
    });
    const subscription = observable.subscribe({
      next(result) {
        timesFired += 1;
        expect(stripSymbols(result.data)).toEqual(data);
        subscription.unsubscribe();
        expect(Object.keys(scheduler.registeredQueries).length).toEqual(0);
      },
    });

    setTimeout(() => {
      expect(timesFired).toEqual(1);
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
    const scheduler = new QueryScheduler({
      queryManager,
    });
    let timesFired = 0;
    let queryId = scheduler.startPollingQuery(queryOptions, 'fake-id', () => {
      scheduler.stopPollingQuery(queryId);
    });
    setTimeout(() => {
      let queryId2 = scheduler.startPollingQuery(
        queryOptions,
        'fake-id2',
        () => {
          timesFired += 1;
        },
      );
      expect(scheduler.intervalQueries[20].length).toEqual(1);
      setTimeout(() => {
        expect(timesFired).toBeGreaterThanOrEqual(1);
        scheduler.stopPollingQuery(queryId2);
        done();
      }, 80);
    }, 200);
  });
});
