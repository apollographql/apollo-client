import * as chai from 'chai';
const { assert } = chai;

import gql from 'graphql-tag';

import mockWatchQuery from './mocks/mockWatchQuery';
import mockQueryManager from './mocks/mockQueryManager';
import { ObservableQuery } from '../src/ObservableQuery';

// I'm not sure why mocha doesn't provide something like this, you can't
// always use promises
const wrap = (done: Function, cb: (...args: any[]) => any) => (...args: any[]) => {
  try {
    return cb(...args);
  } catch (e) {
    done(e);
  }
};

describe('ObservableQuery', () => {
  describe('setVariables', () => {
    const query = gql`
      query($id: ID!){
        people_one(id: $id) {
          name
        }
      }
    `;
    const variables = { id: 1 };
    const differentVariables = { id: 2 };
    const dataOne = {
      people_one: {
        name: 'Luke Skywalker',
      },
    };
    const dataTwo = {
      people_one: {
        name: 'Leia Skywalker',
      },
    };

    it('reruns query if the variables change', (done) => {
      const observable: ObservableQuery = mockWatchQuery({
        request: { query, variables },
        result: { data: dataOne },
      }, {
        request: { query, variables: differentVariables },
        result: { data: dataTwo },
      });

      let handleCount = 0;
      observable.subscribe({
        next: wrap(done, result => {
          handleCount++;

          if (handleCount === 1) {
            assert.deepEqual(result.data, dataOne);
            observable.setVariables(differentVariables);
          } else if (handleCount === 2) {
            assert.isTrue(result.loading);
            assert.deepEqual(result.data, dataOne);
          } else if (handleCount === 3) {
            assert.isFalse(result.loading);
            assert.deepEqual(result.data, dataTwo);
            done();
          }
        }),
      });
    });

    it('reruns observer callback if the variables change but data does not', (done) => {
      const observable: ObservableQuery = mockWatchQuery({
        request: { query, variables },
        result: { data: dataOne },
      }, {
        request: { query, variables: differentVariables },
        result: { data: dataOne },
      });

      let handleCount = 0;
      observable.subscribe({
        next: wrap(done, result => {
          handleCount++;

          if (handleCount === 1) {
            assert.deepEqual(result.data, dataOne);
            observable.setVariables(differentVariables);
          } else if (handleCount === 2) {
            assert.isTrue(result.loading);
            assert.deepEqual(result.data, dataOne);
          } else if (handleCount === 3) {
            assert.deepEqual(result.data, dataOne);
            done();
          }
        }),
      });
    });

    it('does not rerun observer callback if the variables change but new data is in store', (done) => {
      const manager = mockQueryManager({
        request: { query, variables },
        result: { data: dataOne },
      }, {
        request: { query, variables: differentVariables },
        result: { data: dataOne },
      });

      manager.query({ query, variables: differentVariables })
        .then(() => {
          const observable: ObservableQuery = manager.watchQuery({ query, variables });

          let handleCount = 0;
          let errored = false;
          observable.subscribe({
            next: wrap(done, result => {
              handleCount++;

              if (handleCount === 1) {
                assert.deepEqual(result.data, dataOne);
                observable.setVariables(differentVariables);

                // Nothing should happen, so we'll wait a moment to check that
                setTimeout(() => !errored && done(), 10);
              } else if (handleCount === 2) {
                errored = true;
                throw new Error('Observable callback should not fire twice');
              }
            }),
          });
        });
    });

    it('does not rerun query if variables do not change', (done) => {
      const observable: ObservableQuery = mockWatchQuery({
        request: { query, variables },
        result: { data: dataOne },
      }, {
        request: { query, variables },
        result: { data: dataTwo },
      });

      let handleCount = 0;
      let errored = false;
      observable.subscribe({
        next: wrap(done, result => {
          handleCount++;

          if (handleCount === 1) {
            assert.deepEqual(result.data, dataOne);
            observable.setVariables(variables);

            // Nothing should happen, so we'll wait a moment to check that
            setTimeout(() => !errored && done(), 10);
          } else if (handleCount === 2) {
            errored = true;
            throw new Error('Observable callback should not fire twice');
          }
        }),
      });
    });
  });
});
