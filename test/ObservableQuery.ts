import * as chai from 'chai';
const { assert } = chai;

import gql from 'graphql-tag';

import mockQueryManager from './mocks/mockQueryManager';
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

    it('returns results from the store immediately', () => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { data: dataOne },
      });

      return queryManager.query({ query, variables })
        .then(result => {
          assert.deepEqual(result, {
            data: dataOne,
            loading: false,
          });

          const observable = queryManager.watchQuery({
            query,
            variables,
            returnPartialData: true,
          });
          assert.deepEqual(observable.currentResult(), {
            data: dataOne,
            loading: true,
          });
        });
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
