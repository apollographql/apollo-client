/*
 * This test is used to verify the requirements for how react-apollo
 * preserves observables using QueryRecycler. Eventually, QueryRecycler
 * will be removed, but this test file should still be valid
 */

// externals
import gql from 'graphql-tag';
import { InMemoryCache } from '../../../cache/inmemory/inMemoryCache';
import { stripSymbols } from '../../../utilities/testing/stripSymbols';
import {
  MockSubscriptionLink
} from '../../../utilities/testing/mocking/mockSubscriptionLink';

// core
import { QueryManager } from '../../QueryManager';

describe('Subscription lifecycles', () => {
  it('cleans up and reuses data like QueryRecycler wants', done => {
    const query = gql`
      query Luke {
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
      cache: new InMemoryCache({ addTypename: false }),
      link,
    });

    // step 1, get some data
    const observable = queryManager.watchQuery<any>({
      query,
      variables: {},
      fetchPolicy: 'cache-and-network',
    });

    const observableQueries = [];
    let count = 0;

    const resubscribe = () => {
      const { observableQuery, subscription } = observableQueries.pop();
      subscription.unsubscribe();

      observableQuery.setOptions({
        query,
        fetchPolicy: 'cache-and-network',
      });

      return observableQuery;
    };

    const sub = observable.subscribe({
      next: result => {
        count++;
        if (count === 1) {
          expect(result.data).toBeUndefined();
          expect(result.loading).toBe(true);
        }
        if (count === 2) {
          expect(result.loading).toBe(false);
          expect(stripSymbols(result.data)).toEqual(initialData);
          expect(stripSymbols(observable.getCurrentResult().data)).toEqual(
            initialData,
          );

          // step 2, recycle it
          observable.setOptions({
            fetchPolicy: 'standby',
            pollInterval: 0,
          });

          observableQueries.push({
            observableQuery: observable,
            subscription: observable.subscribe({}),
          });

          // step 3, unsubscribe from observable
          sub.unsubscribe();

          setTimeout(() => {
            // step 4, start new Subscription;
            const recyled = resubscribe();
            const currentResult = recyled.getCurrentResult();
            expect(recyled.isTornDown).toEqual(false);
            expect(stripSymbols(currentResult.data)).toEqual(initialData);
            done();
          }, 10);
        }
      },
    });

    setInterval(() => {
      // fire off first result
      link.simulateResult({ result: { data: initialData } });
    }, 10);
  });
});
