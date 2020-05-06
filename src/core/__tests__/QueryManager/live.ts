/*
 * This test is used to verify the requirements for how react-apollo
 * preserves observables using QueryRecycler. Eventually, QueryRecycler
 * will be removed, but this test file should still be valid
 */

// externals
import gql from 'graphql-tag';
import { InMemoryCache } from '../../../cache/inmemory/inMemoryCache';
import { stripSymbols } from '../../../utilities/testing/stripSymbols';
import { MockSubscriptionLink } from '../../../utilities/testing/mocking/mockSubscriptionLink';

// core
import { QueryManager } from '../../QueryManager';

describe('Live queries', () => {
  it('handles mutliple results for live queries', done => {
    const query = gql`
      query LazyLoadLuke {
        people_one(id: 1) {
          name
          friends @live {
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

    const laterData = {
      people_one: {
        name: 'Luke Skywalker',
        friends: [{ name: 'Leia Skywalker' }, { name: 'R2D2' }],
      },
    };
    const link = new MockSubscriptionLink();
    const queryManager = new QueryManager({
      cache: new InMemoryCache({ addTypename: false }),
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
          expect(stripSymbols(result.data)).toEqual(initialData);
          setTimeout(() => {
            link.simulateResult({ result: { data: laterData } });
          }, 10);
        }
        if (count === 2) {
          expect(stripSymbols(result.data)).toEqual(laterData);
          done();
        }
      },
      error: e => {
        console.error(e);
      },
    });

    setTimeout(() => {
      // fire off first result
      link.simulateResult({ result: { data: initialData } });
    }, 10);
  });

  // watchQuery => Observable => subscribe => data1 => unsubscribe =>
  //    watchQuery => Observable => subscribe => data2
  it('handles unsubscribing and resubscribing with live queries', done => {
    const query = gql`
      query LazyLoadLuke {
        people_one(id: 1) {
          name
          friends @live {
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

    const laterData = {
      people_one: {
        name: 'Luke Skywalker',
        friends: [{ name: 'Leia Skywalker' }, { name: 'R2D2' }],
      },
    };

    let count = 0;
    const link = new MockSubscriptionLink();
    const queryManager = new QueryManager({
      cache: new InMemoryCache({ addTypename: false }),
      link,
    });

    const round2 = () => {
      // watchQuery => Observable
      const observable = queryManager.watchQuery<any>({
        query,
        variables: {},
      });

      // Observable => subscribe
      observable.subscribe(result => {
        count++;
        if (count === 2) {
          expect(stripSymbols(result.data)).toEqual(laterData);
          done();
        }
      });

      // subscribe => data2
      link.simulateResult({ result: { data: laterData } });
    };

    // watchQuery => Observable
    const observable = queryManager.watchQuery<any>({
      query,
      variables: {},
    });

    // Observable => subscribe
    const sub = observable.subscribe(result => {
      count++;
      if (count === 1) {
        expect(stripSymbols(result.data)).toEqual(initialData);

        // data1 => unsubscribe
        sub.unsubscribe();
        round2();
      }
    });

    setTimeout(() => {
      // subscribe => data1
      link.simulateResult({ result: { data: initialData } });
    }, 10);
  });
  // watchQuery => Observable => subscribe => setupNetwork => data1 =>
  //    unsubscribe => cleanup => watchQuery => Observable => subscribe =>
  //      setupNetwork => data2 => cleanup
  it('calls the correct cleanup for links with live queries', done => {
    const query = gql`
      query LazyLoadLuke {
        people_one(id: 1) {
          name
          friends @live {
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

    const laterData = {
      people_one: {
        name: 'Luke Skywalker',
        friends: [{ name: 'Leia Skywalker' }, { name: 'R2D2' }],
      },
    };

    let count = 0;
    let cleanedupTimes = 0;
    let createNetworkTimes = 0;
    const link = new MockSubscriptionLink();
    link.onSetup(() => createNetworkTimes++);
    link.onUnsubscribe(() => cleanedupTimes++);

    const queryManager = new QueryManager({
      cache: new InMemoryCache({ addTypename: false }),
      link,
    });

    const round2 = () => {
      // watchQuery => Observable
      const observable = queryManager.watchQuery<any>({
        query,
        variables: {},
      });

      // Observable => subscribe
      const sub = observable.subscribe(result => {
        count++;
        if (count === 2) {
          expect(stripSymbols(result.data)).toEqual(laterData);
          sub.unsubscribe();
          expect(cleanedupTimes).toBe(2);
          expect(createNetworkTimes).toBe(2);
          done();
        }
      });

      // subscribe => data2
      link.simulateResult({ result: { data: laterData } });
    };

    // watchQuery => Observable
    const observable = queryManager.watchQuery<any>({
      query,
      variables: {},
    });

    // Observable => subscribe
    const sub = observable.subscribe(result => {
      count++;
      if (count === 1) {
        expect(stripSymbols(result.data)).toEqual(initialData);

        // data1 => unsubscribe
        sub.unsubscribe();
        round2();
      }
    });

    setTimeout(() => {
      // subscribe => data1
      link.simulateResult({ result: { data: initialData } });
    }, 10);
  });
});
