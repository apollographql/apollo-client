// externals
import * as Rx from 'rxjs';
import { assign } from 'lodash';
import gql from 'graphql-tag';
import { DocumentNode, ExecutionResult } from 'graphql';
import { ApolloLink, Operation, Observable } from 'apollo-link-core';
import InMemoryCache, { ApolloReducerConfig } from 'apollo-cache-core-inmemory';

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

describe('Link interactions', () => {
  it('includes the cache on the context for eviction links', done => {
    const query = gql`
      query CachedLuke {
        people_one(id: 1) {
          name
          friends {
            name
          }
        }
      }
    `;

    const initialData = {
      people_one: {
        name: 'Luke Skywalker',
        friends: [{ name: 'Leia Skywalker' }],
      },
    };

    const evictionLink = (operation, forward) => {
      const { cache } = operation.context;
      expect(cache).toBeDefined();
      return forward(operation).map(result => {
        setTimeout(() => {
          const cacheResult = cache.read({ query });
          expect(cacheResult).toEqual(initialData);
          expect(cacheResult).toEqual(result.data);
          if (count === 1) {
            done();
          }
        }, 10);
        return result;
      });
    };

    const mockLink = new MockSubscriptionLink();
    const link = ApolloLink.from([evictionLink, mockLink]);
    const queryManager = new QueryManager({
      store: new DataStore(new InMemoryCache({}, { addTypename: false })),
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
      },
      error: e => {
        console.error(e);
      },
    });

    // fire off first result
    mockLink.simulateResult({ result: { data: initialData } });
  });
  it('cleans up all links on the final unsubscribe from watchQuery', done => {
    const query = gql`
      query WatchedLuke {
        people_one(id: 1) {
          name
          friends {
            name
          }
        }
      }
    `;

    const initialData = {
      people_one: {
        name: 'Luke Skywalker',
        friends: [{ name: 'Leia Skywalker' }],
      },
    };

    const link = new MockSubscriptionLink();
    const queryManager = new QueryManager({
      store: new DataStore(new InMemoryCache({}, { addTypename: false })),
      link,
    });

    const observable = queryManager.watchQuery<any>({
      query,
      variables: {},
    });

    let count = 0;
    let four;
    // first watch
    const one = observable.subscribe(result => count++);
    // second watch
    const two = observable.subscribe(result => count++);
    // third watch (to be unsubscribed)
    const three = observable.subscribe(result => {
      count++;
      three.unsubscribe();
      // fourth watch
      four = observable.subscribe(x => count++);
    });

    // fire off first result
    link.simulateResult({ result: { data: initialData } });
    setTimeout(() => {
      one.unsubscribe();

      link.simulateResult({
        result: {
          data: {
            people_one: {
              name: 'Luke Skywalker',
              friends: [{ name: 'R2D2' }],
            },
          },
        },
      });
      setTimeout(() => {
        four.unsubscribe();
        // final unsubscribe should be called now
        two.unsubscribe();
      }, 10);
    }, 10);

    link.onUnsubscribe(() => {
      expect(count).toEqual(6);
      done();
    });
  });
  it('cleans up all links on the final unsubscribe from watchQuery [error]', done => {
    const query = gql`
      query WatchedLuke {
        people_one(id: 1) {
          name
          friends {
            name
          }
        }
      }
    `;

    const initialData = {
      people_one: {
        name: 'Luke Skywalker',
        friends: [{ name: 'Leia Skywalker' }],
      },
    };

    const link = new MockSubscriptionLink();
    const queryManager = new QueryManager({
      store: new DataStore(new InMemoryCache({}, { addTypename: false })),
      link,
    });

    const observable = queryManager.watchQuery<any>({
      query,
      variables: {},
    });

    let count = 0;
    let four;
    let finished = false;
    // first watch
    const one = observable.subscribe(result => count++);
    // second watch
    const two = observable.subscribe({
      next: result => count++,
      error: e => {
        count = 0;
      },
    });
    // third watch (to be unsubscribed)
    const three = observable.subscribe(result => {
      count++;
      three.unsubscribe();
      // fourth watch
      four = observable.subscribe(x => count++);
    });

    // fire off first result
    link.simulateResult({ result: { data: initialData } });
    setTimeout(() => {
      one.unsubscribe();
      four.unsubscribe();

      // final unsubscribe should be called now
      // since errors clean up subscriptions
      link.simulateResult({ error: new Error('dang') });

      setTimeout(() => {
        expect(count).toEqual(0);
        done();
      }, 10);
    }, 10);

    link.onUnsubscribe(() => {
      expect(count).toEqual(4);
      finished = true;
    });
  });
});
