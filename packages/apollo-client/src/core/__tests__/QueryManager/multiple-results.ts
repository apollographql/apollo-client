// externals
import Rx from 'rxjs';
import { assign } from 'lodash';
import gql from 'graphql-tag';
import { DocumentNode, ExecutionResult } from 'graphql';
import { ApolloLink, Operation, Observable } from 'apollo-link';
import { InMemoryCache, ApolloReducerConfig } from 'apollo-cache-inmemory';
import { stripSymbols } from 'apollo-utilities';

// mocks
import mockQueryManager from '../../../__mocks__/mockQueryManager';
import mockWatchQuery from '../../../__mocks__/mockWatchQuery';
import {
  mockSingleLink,
  MockSubscriptionLink,
} from '../../../__mocks__/mockLinks';

// core
import { ApolloQueryResult } from '../../types';
import { NetworkStatus } from '../../networkStatus';
import { ObservableQuery } from '../../ObservableQuery';
import { WatchQueryOptions } from '../../watchQueryOptions';
import { QueryManager } from '../../QueryManager';

import { ApolloError } from '../../../errors/ApolloError';
import { DataStore } from '../../../data/store';
import { Observer } from '../../../util/Observable';

// testing utils
import wrap from '../../../util/wrap';
import observableToPromise, {
  observableToPromiseAndSubscription,
} from '../../../util/observableToPromise';

describe('mutiple results', () => {
  it('allows multiple query results from link', done => {
    const query = gql`
      query LazyLoadLuke {
        people_one(id: 1) {
          name
          friends @defer {
            name
          }
        }
      }
    `;

    const initialData = {
      people_one: {
        name: 'Luke Skywalker',
        friends: null,
      },
    };

    const laterData = {
      people_one: {
        // XXX true defer's wouldn't send this
        name: 'Luke Skywalker',
        friends: [{ name: 'Leia Skywalker' }],
      },
    };
    const link = new MockSubscriptionLink();
    const queryManager = new QueryManager({
      store: new DataStore(new InMemoryCache({ addTypename: false })),
      link,
    });

    const observable = queryManager.watchQuery<any>({
      query,
      variables: {},
    });

    let count = 0;
    observable.subscribe({
      next: result => {
        count++;
        if (count === 1) {
          link.simulateResult({ result: { data: laterData } });
        }
        if (count === 2) {
          done();
        }
      },
      error: e => {
        console.error(e);
      },
    });

    // fire off first result
    link.simulateResult({ result: { data: initialData } });
  });

  it('allows multiple query results from link with ignored errors', done => {
    const query = gql`
      query LazyLoadLuke {
        people_one(id: 1) {
          name
          friends @defer {
            name
          }
        }
      }
    `;

    const initialData = {
      people_one: {
        name: 'Luke Skywalker',
        friends: null,
      },
    };

    const laterData = {
      people_one: {
        // XXX true defer's wouldn't send this
        name: 'Luke Skywalker',
        friends: [{ name: 'Leia Skywalker' }],
      },
    };
    const link = new MockSubscriptionLink();
    const queryManager = new QueryManager({
      store: new DataStore(new InMemoryCache({ addTypename: false })),
      link,
    });

    const observable = queryManager.watchQuery<any>({
      query,
      variables: {},
      errorPolicy: 'ignore',
    });

    let count = 0;
    observable.subscribe({
      next: result => {
        // errors should never be passed since they are ignored
        expect(result.errors).toBeUndefined();
        count++;
        if (count === 1) {
          // this shouldn't fire the next event again
          link.simulateResult({
            result: { errors: [new Error('defer failed')] },
          });
          setTimeout(() => {
            link.simulateResult({ result: { data: laterData } });
          }, 20);
        }
        if (count === 2) {
          // make sure the count doesn't go up by accident
          setTimeout(() => {
            if (count === 3) throw new Error('error was not ignored');
            done();
          });
        }
      },
      error: e => {
        console.error(e);
      },
    });

    // fire off first result
    link.simulateResult({ result: { data: initialData } });
  });
  it('strips errors from a result if ignored', done => {
    const query = gql`
      query LazyLoadLuke {
        people_one(id: 1) {
          name
          friends @defer {
            name
          }
        }
      }
    `;

    const initialData = {
      people_one: {
        name: 'Luke Skywalker',
        friends: null,
      },
    };

    const laterData = {
      people_one: {
        // XXX true defer's wouldn't send this
        name: 'Luke Skywalker',
        friends: [{ name: 'Leia Skywalker' }],
      },
    };
    const link = new MockSubscriptionLink();
    const queryManager = new QueryManager({
      store: new DataStore(new InMemoryCache({ addTypename: false })),
      link,
    });

    const observable = queryManager.watchQuery<any>({
      query,
      variables: {},
      errorPolicy: 'ignore',
    });

    let count = 0;
    observable.subscribe({
      next: result => {
        // errors should never be passed since they are ignored
        expect(result.errors).toBeUndefined();
        count++;

        if (count === 1) {
          expect(stripSymbols(result.data)).toEqual(initialData);
          // this should fire the `next` event without this error
          link.simulateResult({
            result: { errors: [new Error('defer failed')], data: laterData },
          });
        }
        if (count === 2) {
          expect(stripSymbols(result.data)).toEqual(laterData);
          expect(result.errors).toBeUndefined();
          // make sure the count doesn't go up by accident
          setTimeout(() => {
            if (count === 3) done.fail(new Error('error was not ignored'));
            done();
          }, 10);
        }
      },
      error: e => {
        console.error(e);
      },
    });

    // fire off first result
    link.simulateResult({ result: { data: initialData } });
  });

  xit('allows multiple query results from link with all errors', done => {
    const query = gql`
      query LazyLoadLuke {
        people_one(id: 1) {
          name
          friends @defer {
            name
          }
        }
      }
    `;

    const initialData = {
      people_one: {
        name: 'Luke Skywalker',
        friends: null,
      },
    };

    const laterData = {
      people_one: {
        // XXX true defer's wouldn't send this
        name: 'Luke Skywalker',
        friends: [{ name: 'Leia Skywalker' }],
      },
    };
    const link = new MockSubscriptionLink();
    const queryManager = new QueryManager({
      store: new DataStore(new InMemoryCache({ addTypename: false })),
      link,
    });

    const observable = queryManager.watchQuery<any>({
      query,
      variables: {},
      errorPolicy: 'all',
    });

    let count = 0;
    observable.subscribe({
      next: result => {
        try {
          // errors should never be passed since they are ignored
          count++;
          if (count === 1) {
            expect(result.errors).toBeUndefined();
            // this should fire the next event again
            link.simulateResult({
              result: { errors: [new Error('defer failed')] },
            });
          }
          if (count === 2) {
            expect(result.errors).toBeDefined();
            link.simulateResult({ result: { data: laterData } });
          }
          if (count === 3) {
            expect(result.errors).toBeUndefined();
            // make sure the count doesn't go up by accident
            setTimeout(() => {
              if (count === 4) done.fail(new Error('error was not ignored'));
              done();
            });
          }
        } catch (e) {
          done.fail(e);
        }
      },
      error: e => {
        done.fail(e);
      },
    });

    // fire off first result
    link.simulateResult({ result: { data: initialData } });
  });
  it('closes the observable if an error is set with the none policy', done => {
    const query = gql`
      query LazyLoadLuke {
        people_one(id: 1) {
          name
          friends @defer {
            name
          }
        }
      }
    `;

    const initialData = {
      people_one: {
        name: 'Luke Skywalker',
        friends: null,
      },
    };

    const laterData = {
      people_one: {
        // XXX true defer's wouldn't send this
        name: 'Luke Skywalker',
        friends: [{ name: 'Leia Skywalker' }],
      },
    };
    const link = new MockSubscriptionLink();
    const queryManager = new QueryManager({
      store: new DataStore(new InMemoryCache({ addTypename: false })),
      link,
    });

    const observable = queryManager.watchQuery<any>({
      query,
      variables: {},
      // errorPolicy: 'none', // this is the default
    });

    let count = 0;
    observable.subscribe({
      next: result => {
        // errors should never be passed since they are ignored
        count++;
        if (count === 1) {
          expect(result.errors).toBeUndefined();
          // this should fire the next event again
          link.simulateResult({
            result: { errors: [new Error('defer failed')] },
          });
        }
        if (count === 2) {
          console.log(new Error('result came after an error'));
        }
      },
      error: e => {
        expect(e).toBeDefined();
        expect(e.graphQLErrors).toBeDefined();
        done();
      },
    });

    // fire off first result
    link.simulateResult({ result: { data: initialData } });
  });
});
