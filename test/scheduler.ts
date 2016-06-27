import { QueryScheduler } from '../src/scheduler';
import { assert } from 'chai';
import {
  WatchQueryOptions,
  QueryManager,
} from '../src/QueryManager';
import {
  createApolloStore,
} from '../src/store';
import mockNetworkInterface from './mocks/mockNetworkInterface';
import gql from 'graphql-tag';

describe('QueryScheduler', () => {
  it('should throw an error if we try to register a non-polling query', () => {
    const queryManager = new QueryManager({
      networkInterface: mockNetworkInterface(),
      store: createApolloStore(),
      reduxRootKey: 'apollo',
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
      }`;
    const queryOptions: WatchQueryOptions = {
      query,
    };
    assert.throws(() => {
      scheduler.registerPollingQuery(queryOptions);
    });
  });

  it('should correctly start polling queries', (done) => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;

    const data = {
      'author': {
        'firstName': 'John',
        'lastName': 'Smith',
      },
    };
    const queryOptions = {
      query,
      pollInterval: 80,
    };

    const networkInterface = mockNetworkInterface(
      {
        request: queryOptions,
        result: { data },
      }
    );
    const queryManager = new QueryManager({
      networkInterface: networkInterface,
      store: createApolloStore(),
      reduxRootKey: 'apollo',
    });
    const scheduler = new QueryScheduler({
      queryManager,
    });
    let timesFired = 0;
    const queryId = scheduler.startPollingQuery(queryOptions, (queryStoreValue) => {
      timesFired += 1;
    });
    setTimeout(() => {
      assert.isAtLeast(timesFired, 0);
      scheduler.stopPollingQuery(queryId);
      done();
    }, 120);
  });

  it('should correctly stop polling queries', (done) => {
    const query = gql`
      query {
        someAlias: author {
          firstName
          lastName
        }
      }`;
    const data = {
      'someAlias': {
        'firstName': 'John',
        'lastName': 'Smith',
      },
    };
    const queryOptions = {
      query,
      pollInterval: 20,
    };
    const networkInterface = mockNetworkInterface(
      {
        request: queryOptions,
        result: { data },
      }
    );
    const queryManager = new QueryManager({
      networkInterface: networkInterface,
      store: createApolloStore(),
      reduxRootKey: 'apollo',
    });
    const scheduler = new QueryScheduler({
      queryManager,
    });
    let timesFired = 0;
    let queryId = scheduler.startPollingQuery(queryOptions, (queryStoreValue) => {
      timesFired += 1;
      scheduler.stopPollingQuery(queryId);
    });

    setTimeout(() => {
      assert.equal(timesFired, 1);
      done();
    }, 170);
  });

  it('should register a query and return an observable that can be unsubscribed', (done) => {
    const myQuery = gql`
      query {
        someAuthorAlias: author {
          firstName
          lastName
        }
      }`;
    const data = {
      'someAuthorAlias': {
        'firstName': 'John',
        'lastName': 'Smith',
      },
    };
    const queryOptions = {
      query: myQuery,
      pollInterval: 20,
    };
    const networkInterface = mockNetworkInterface(
      {
        request: queryOptions,
        result: { data },
      }
    );
    const queryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
      reduxRootKey: 'apollo',
    });
    const scheduler = new QueryScheduler({
      queryManager,
    });
    let timesFired = 0;
    let observableQuery = scheduler.registerPollingQuery(queryOptions);
    let subscription = observableQuery.subscribe({
      next(result) {
        timesFired += 1;
        assert.deepEqual(result, { data });
        subscription.unsubscribe();
      },
    });

    setTimeout(() => {
      assert.equal(timesFired, 1);
      done();
    }, 100);
  });

  it('should handle network errors on polling queries correctly', (done) => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
    const error = new Error('something went terribly wrong');
    const queryOptions = {
      query,
      pollInterval: 80,
    };
    const networkInterface = mockNetworkInterface(
      {
        request: queryOptions,
        error,
      }
    );
    const queryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
      reduxRootKey: 'apollo',
    });
    const scheduler = new QueryScheduler({
      queryManager,
    });
    let observableQuery = scheduler.registerPollingQuery(queryOptions);
    const subscription = observableQuery.subscribe({
      next(result) {
        done(new Error('Observer provided a result despite a network error.'));
      },

      error(errorVal) {
        assert(errorVal);
        subscription.unsubscribe();
        done();
      },
    });
  });

  it('should handle graphql errors on polling queries correctly', (done) => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
    const errors = [new Error('oh no something went wrong')];
    const queryOptions = {
      query,
      pollInterval: 80,
    };
    const networkInterface = mockNetworkInterface(
      {
        request: queryOptions,
        result: { errors },
      }
    );
    const queryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
      reduxRootKey: 'apollo',
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
  it('should keep track of in flight queries', (done) => {
    const query = gql`
      query {
        fortuneCookie
      }`;
    const data = {
      'fortuneCookie': 'lol',
    };
    const queryOptions = {
      query,
      pollInterval: 70,
    };
    const networkInterface = mockNetworkInterface(
      {
        request: queryOptions,
        result: { data },
        delay: 20000, //i.e. should never return
      },
      {
        request: queryOptions,
        result: { data },
        delay: 20000,
      }
    );
    const queryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
      reduxRootKey: 'apollo',
    });
    const scheduler = new QueryScheduler({
      queryManager,
    });
    const observer = scheduler.registerPollingQuery(queryOptions);
    const subscription = observer.subscribe({});

    // as soon as we register a query, there should be an addition to the query map.
    assert.equal(Object.keys(scheduler.inFlightQueries).length, 1);
    setTimeout(() => {
      assert.equal(Object.keys(scheduler.inFlightQueries).length, 1);
      assert.deepEqual(scheduler.inFlightQueries[0], queryOptions);
      subscription.unsubscribe();
      done();
    }, 100);
  });

  it('should not fire another query if one with the same id is in flight', (done) => {
    const query = gql`
      query {
        fortuneCookie
      }`;
    const data = {
      'fortuneCookie': 'you will live a long life',
    };
    const queryOptions = {
      query,
      pollInterval: 10,
    };
    const networkInterface = mockNetworkInterface(
      {
        request: queryOptions,
        result: { data },
        delay: 20000,
      }
    );
    const queryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
      reduxRootKey: 'apollo',
    });
    const scheduler = new QueryScheduler({
      queryManager,
    });
    const observer = scheduler.registerPollingQuery(queryOptions);
    const subscription = observer.subscribe({});
    setTimeout(() => {
      assert.equal(Object.keys(scheduler.inFlightQueries).length, 1);
      subscription.unsubscribe();
      done();
    }, 100);
  });
});
