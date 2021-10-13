// TODO: What is this file and why does it exist
// externals
import gql from 'graphql-tag';
import { InMemoryCache } from '../../../cache/inmemory/inMemoryCache';

// mocks
import { MockSubscriptionLink } from '../../../testing/core';

// core
import { QueryManager } from '../../QueryManager';

describe('defer', () => {
  it('can handle defer', () => new Promise<void>((resolve, reject) => {
    const query = gql`
      query LazyLoadLuke {
        people_one(id: 1) {
          name
          ... on Person @defer {
            friends {
              name
            }
          }
        }
      }
    `;

    const errorMock = jest.spyOn(console, 'error');

    const initialData = {
      people_one: { name: 'Luke Skywalker', __typename: 'Person' },
    };

    const laterData = {
      friends: [{ name: 'Leia Skywalker', __typename: 'Person' }],
    };

    const link = new MockSubscriptionLink();
    const queryManager = new QueryManager({
      cache: new InMemoryCache(),
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
          try {
            expect(result.data).toEqual(initialData);
          } catch (err) {
            reject(err);
          }

          link.simulateResult({
            result: {
              data: laterData,
              path: ['people_one'],
            },
          });
        } else if (count === 2) {
          try {
            expect(result.data).toEqual({
              ...initialData,
              "people_one": {
                ...initialData.people_one,
                ...laterData,
              },
            });

            expect(errorMock).toHaveBeenCalledTimes(0);
            errorMock.mockRestore();
            resolve();
          } catch (err) {
            reject(err);
          }
        }
      },
      error: err => {
        reject(err);
      },
    });

    // fire off first result
    link.simulateResult({ result: { data: initialData } });
  }));
});
