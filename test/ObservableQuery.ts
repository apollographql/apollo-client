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
    query($id: ID!) {
      people_one(id: $id) {
        name
      }
    }
  `;
  const superQuery = gql`
    query($id: ID!) {
      people_one(id: $id) {
        name
        age
      }
    }
  `;
  const variables = { id: 1 };
  const dataOne = {
    people_one: {
      name: 'Luke Skywalker',
    },
  };
  const superDataOne = {
    people_one: {
      name: 'Luke Skywalker',
      age: 21,
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
        delay: 100,
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
        .then((result: any) => {
          assert.deepEqual(result, {
            data: dataOne,
            loading: false,
          });

          const observable = queryManager.watchQuery({
            query,
            variables,
          });
          assert.deepEqual(observable.currentResult(), {
            data: dataOne,
            loading: false,
          });
        });
    });

    it('returns partial data from the store immediately', (done) => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { data: dataOne },
      }, {
        request: { query: superQuery, variables },
        result: { data: superDataOne },
      });

      queryManager.query({ query, variables })
        .then((result: any) => {
          const observable = queryManager.watchQuery({
            query: superQuery,
            variables,
            returnPartialData: true,
          });
          assert.deepEqual(observable.currentResult(), {
            data: dataOne,
            loading: true,
          });

          // we can use this to trigger the query
          let handleCount = 0;
          observable.subscribe({
            next: wrap(done, (subResult) => {
              handleCount += 1;
              assert.deepEqual(subResult, observable.currentResult());

              if (handleCount === 1) {
                assert.deepEqual(subResult, {
                  data: dataOne,
                  loading: true,
                });
              } else if (handleCount === 2) {
                assert.deepEqual(subResult, {
                  data: superDataOne,
                  loading: false,
                });
                done();
              }
            }),
          });
        });
    });

    it('returns loading even if full data is available when force fetching', (done) => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { data: dataOne },
      }, {
        request: { query, variables },
        result: { data: dataTwo },
      });

      queryManager.query({ query, variables })
        .then((result: any) => {
          const observable = queryManager.watchQuery({
            query,
            variables,
            forceFetch: true,
          });
          assert.deepEqual(observable.currentResult(), {
            data: dataOne,
            loading: true,
          });

          // we can use this to trigger the query
          let handleCount = 0;
          observable.subscribe({
            next: wrap(done, (subResult) => {
              handleCount += 1;
              assert.deepEqual(subResult, observable.currentResult());

              if (handleCount === 1) {
                assert.deepEqual(subResult, {
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
});
