import * as chai from 'chai';
const { assert } = chai;

import gql from 'graphql-tag';

import mockWatchQuery from './mocks/mockWatchQuery';
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

  describe('setVariables', () => {
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
            assert.deepEqual(result.data, dataTwo);
            done();
          }
        }),
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

  describe('currentResult', () => {
    it('returns the current query status immediately', (done) => {
      const observable: ObservableQuery = mockWatchQuery({
        request: { query, variables },
        result: { data: dataOne },
        delay: 20,
      });

      observable.subscribe({
        next: wrap(done, result => {
          assert.deepEqual(observable.currentResult(), {
            data: dataOne,
            loading: false,
          });
          done();
        }),
      });

      assert.deepEqual(observable.currentResult(), {
        loading: true,
        data: {},
      });
      setTimeout(wrap(done, () => {
        assert.deepEqual(observable.currentResult(), {
          loading: true,
          data: {},
        });
      }), 0);
    });

    it('returns loading while refetching', (done) => {
      const observable: ObservableQuery = mockWatchQuery({
        request: { query, variables },
        result: { data: dataOne },
      }, {
        request: { query, variables },
        result: { data: dataTwo },
      });

      let handleCount = 0;
      observable.subscribe({
        next: wrap(done, result => {
          handleCount++;

          if (handleCount === 1) {
            assert.deepEqual(observable.currentResult(), {
              data: dataOne,
              loading: false,
            });
            observable.refetch();
            assert.deepEqual(observable.currentResult(), {
              loading: true,
              data: {},
            });
          } else if (handleCount === 2) {
            assert.deepEqual(observable.currentResult(), {
              data: dataTwo,
              loading: false,
            });
            done();
          }
        }),
      });
    });
  });
});
