import { QueryScheduler } from '../src/scheduler/scheduler';
import { assert } from 'chai';
import { QueryManager } from '../src/core/QueryManager';
import { WatchQueryOptions } from '../src/core/watchQueryOptions';
import { mockSingleLink } from './mocks/mockLinks';
import { NetworkStatus } from '../src/queries/networkStatus';
import gql from 'graphql-tag';

import { DataStore } from '../src/data/store';
import InMemoryCache from '../src/cache-inmemory';

describe('QueryScheduler', () => {
  it('should throw an error if we try to start polling a non-polling query', () => {
    const queryManager = new QueryManager({
      link: mockSingleLink(),
      store: new DataStore(new InMemoryCache({}, { addTypename: false })),
      addTypename: false,
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
    assert.throws(() => {
      scheduler.startPollingQuery(queryOptions, null as never);
    });
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
      store: new DataStore(new InMemoryCache({}, { addTypename: false })),

      link: link,
      addTypename: false,
    });
    const scheduler = new QueryScheduler({
      queryManager,
    });
    let timesFired = 0;
    const queryId = scheduler.startPollingQuery(queryOptions, 'fake-id', () => {
      timesFired += 1;
    });
    setTimeout(() => {
      assert.isAtLeast(timesFired, 0);
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
      store: new DataStore(new InMemoryCache()),

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
      assert.equal(timesFired, 1);
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
      store: new DataStore(new InMemoryCache({}, { addTypename: false })),

      link,
      addTypename: false,
    });
    const scheduler = new QueryScheduler({
      queryManager,
    });
    let timesFired = 0;
    let observableQuery = scheduler.registerPollingQuery(queryOptions);
    let subscription = observableQuery.subscribe({
      next(result) {
        timesFired += 1;
        assert.deepEqual(result.data, data);
        subscription.unsubscribe();
      },
    });

    setTimeout(() => {
      assert.equal(timesFired, 1);
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
      store: new DataStore(new InMemoryCache()),

      link,
    });
    const scheduler = new QueryScheduler({
      queryManager,
    });
    let observableQuery = scheduler.registerPollingQuery(queryOptions);
    const subscription = observableQuery.subscribe({
      next() {
        done(new Error('Observer provided a result despite a network error.'));
      },

      error(errorVal) {
        assert(errorVal);
        const queryId = scheduler.intervalQueries[queryOptions.pollInterval][0];
        assert.isFalse(
          scheduler.checkInFlight(queryId),
          'Should be able to poll after an error',
        );
        subscription.unsubscribe();
        done();
      },
    });
  });

  it('should handle graphql errors on polling queries correctly', done => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const errors = [new Error('oh no something went wrong')];
    const queryOptions = {
      query,
      pollInterval: 80,
    };
    const link = mockSingleLink({
      request: queryOptions,
      result: { errors },
    });
    const queryManager = new QueryManager({
      link,
      store: new DataStore(new InMemoryCache()),
    });
    const scheduler = new QueryScheduler({
      queryManager,
    });
    let observableQuery = scheduler.registerPollingQuery(queryOptions);
    const subscription = observableQuery.subscribe({
      error(errorVal) {
        subscription.unsubscribe();
        assert(errorVal);
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
    assert.equal(Object.keys(scheduler.intervalQueries).length, 1);
    assert.equal(
      Object.keys(scheduler.intervalQueries)[0],
      queryOptions.pollInterval.toString(),
    );
    const queries = (<any>scheduler.intervalQueries)[
      queryOptions.pollInterval.toString()
    ];
    assert.equal(queries.length, 1);
    assert.equal(queries[0], queryId);
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
      store: new DataStore(new InMemoryCache()),
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
      addTypename: false,
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
    assert.equal(keys.length, 1);
    assert.equal(keys[0], String(interval));

    const queryIds = (<any>scheduler.intervalQueries)[keys[0]];
    assert.equal(queryIds.length, 2);
    assert.deepEqual(scheduler.registeredQueries[queryIds[0]], queryOptions1);
    assert.deepEqual(scheduler.registeredQueries[queryIds[1]], queryOptions2);
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
      store: new DataStore(new InMemoryCache({}, { addTypename: false })),
      link: mockSingleLink({
        request: { query },
        result: { data },
      }),
      addTypename: false,
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
        assert.deepEqual(result.data, data);
        subscription.unsubscribe();
        assert.equal(Object.keys(scheduler.registeredQueries).length, 0);
      },
    });

    setTimeout(() => {
      assert.equal(timesFired, 1);
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
    const link = mockSingleLink({
      request: queryOptions,
      result: { data },
    });
    const queryManager = new QueryManager({
      store: new DataStore(new InMemoryCache({}, { addTypename: false })),
      link: link,
      addTypename: false,
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
      assert.equal(scheduler.intervalQueries[20].length, 1);
      setTimeout(() => {
        assert.isAtLeast(timesFired, 1);
        scheduler.stopPollingQuery(queryId2);
        done();
      }, 300);
    }, 200);
  });
});
