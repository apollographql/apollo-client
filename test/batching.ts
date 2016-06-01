import { QueryScheduler,
         QueryFetchRequest,
       } from '../src/batching';
import { assert } from 'chai';
import mockNetworkInterface from './mocks/mockNetworkInterface';
import { createApolloStore } from '../src/store';
import { QueryManager } from '../src/QueryManager';
import gql from '../src/gql';
import { GraphQLResult } from 'graphql';

const queryManager = new QueryManager({
  networkInterface: mockNetworkInterface(),
  store: createApolloStore(),
  reduxRootKey: 'apollo',
});

describe('QueryScheduler', () => {
  it('should construct', () => {
    assert.doesNotThrow(() => {
      const querySched = new QueryScheduler({
        shouldBatch: true,
        queryManager: queryManager,
      });
      querySched.consumeQueue();
    });
  });

  it('should not do anything when faced with an empty queue', () => {
    const scheduler = new QueryScheduler({
      shouldBatch: true,
      queryManager: queryManager,
    });

    assert.equal(scheduler.fetchRequests.length, 0);
    scheduler.consumeQueue();
    assert.equal(scheduler.fetchRequests.length, 0);
  });

  it('should be able to add to the queue', () => {
    const scheduler = new QueryScheduler({
      shouldBatch: true,
      queryManager: queryManager,
    });

    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;

    const request: QueryFetchRequest = {
      options: { query },
      queryId: 'not-a-real-id',
    };

    assert.equal(scheduler.fetchRequests.length, 0);
    scheduler.queueRequest(request);
    assert.equal(scheduler.fetchRequests.length, 1);
    scheduler.queueRequest(request);
    assert.equal(scheduler.fetchRequests.length, 2);
  });

  describe('request queue', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
    const data = {
      'author' : {
        'firstName': 'John',
        'lastName': 'Smith',
      },
    };
    const networkInterface = mockNetworkInterface(
      {
        request: { query },
        result: { data },
      }
    );
    const myQueryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
      reduxRootKey: 'apollo',
    });
    const scheduler = new QueryScheduler({
      shouldBatch: true,
      queryManager: myQueryManager,
    });
    const request: QueryFetchRequest = {
      options: { query },
      queryId: 'not-a-real-id',
    };

    it('should be able to consume from a queue containing a single query', (done) => {
      scheduler.queueRequest(request);
      const promises: Promise<GraphQLResult>[] = scheduler.consumeQueue();
      assert.equal(scheduler.fetchRequests.length, 0);
      assert.equal(promises.length, 1);
      promises[0].then((resultObj) => {
        assert.deepEqual(resultObj, { data } );
        done();
      });
    });

    it('should be able to consume from a queue containing multiple queries', (done) => {
      scheduler.queueRequest(request);
      scheduler.queueRequest(request);
      const promises: Promise<GraphQLResult>[] = scheduler.consumeQueue();
      assert.equal(scheduler.fetchRequests.length, 0);
      assert.equal(promises.length, 2);
      promises[0].then((resultObj1) => {
        assert.deepEqual(resultObj1, { data });
        promises[1].then((resultObj2) => {
          assert.deepEqual(resultObj2, { data });
          done();
        });
      });
    });
  });
});
