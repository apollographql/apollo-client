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

    it('should be able to consume from a queue containing a single query',
       (done) => {
      scheduler.queueRequest(request);
      const promises: Promise<GraphQLResult>[] = scheduler.consumeQueue();
      assert.equal(scheduler.fetchRequests.length, 0);
      assert.equal(promises.length, 1);
      promises[0].then((resultObj) => {
        assert.deepEqual(resultObj, { data } );
        done();
      });
    });

    it('should be able to consume from a queue containing multiple queries',
       (done) => {
      const request2 = {
        options: { query },
        queryId: 'another-fake-id',
      };

      scheduler.queueRequest(request);
      scheduler.queueRequest(request2);
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

    it('should add requests to the in-flight queue before the request', () => {
      const myScheduler = new QueryScheduler({
        shouldBatch: true,
        queryManager: new QueryManager({
          networkInterface: mockNetworkInterface(),
          store: createApolloStore(),
          reduxRootKey: 'apollo',
        }),
      });
      const request2 = {
        options: { query },
        queryId: 'not-a-real-id2',
      };

      myScheduler.queueRequest(request);
      myScheduler.queueRequest(request2);
      myScheduler.consumeQueue();

      assert.equal(Object.keys(myScheduler.inFlightRequests).length, 2);
    });

    it(`should be able to remove requests from the in-flight queue once the
    server responds`, (done) => {
      scheduler.queueRequest(request);
      scheduler.consumeQueue().forEach((promise) => {
        promise.then((result) => {
          assert.equal(Object.keys(scheduler.inFlightRequests).length, 0);
          done();
        });
      });
    });

    it(`should not fetch a query while a query with the same id is
    in flight`, () => {
      //this network interface will not respond to the query in the duration of
      //this test, leaving the query in flight.
      const myNetworkInterface = mockNetworkInterface(
        {
          request: { query },
          delay: 2000,
        }
      );
      const myScheduler = new QueryScheduler({
        shouldBatch: true,
        queryManager: new QueryManager({
          networkInterface: myNetworkInterface,
          store: createApolloStore(),
          reduxRootKey: 'apollo',
        }),
      });
      myScheduler.queueRequest(request);
      const request2 = {
        options: { query },
        queryId: 'not-a-real-id',
      };
      myScheduler.consumeQueue();
      myScheduler.queueRequest(request2);
      myScheduler.consumeQueue();
      assert.equal(myScheduler.fetchRequests.length, 1);
    });

    it(`should fetch both if one query is queued and one with a diff. id
    is in flight`, () => {
      const myNetworkInterface = mockNetworkInterface(
        {
          request: { query },
          delay: 20000,
        },
        {
          request: { query },
          delay: 20000,
        }
      );
      const myScheduler = new QueryScheduler({
        shouldBatch: true,
        queryManager: new QueryManager({
          networkInterface: myNetworkInterface,
          store: createApolloStore(),
          reduxRootKey: 'apollo',
        }),
      });
      const request2 = {
        options: { query },
        queryId: 'totally-diff-id',
      };

      myScheduler.queueRequest(request);
      myScheduler.consumeQueue();
      assert.equal(myScheduler.fetchRequests.length, 0);
      myScheduler.queueRequest(request2);
      myScheduler.consumeQueue();
      assert.equal(myScheduler.fetchRequests.length, 0);
      assert.equal(Object.keys(myScheduler.inFlightRequests).length, 2);
    });
  });

  it('should be able to stop polling', () => {
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
    const request = {
      options: { query },
      queryId: 'not-a-real-id',
    };

    scheduler.queueRequest(request);
    scheduler.queueRequest(request);

    //poll with a big interval so that the queue
    //won't actually be consumed by the time we stop.
    scheduler.start(1000);
    scheduler.stop();
    assert.equal(scheduler.fetchRequests.length, 2);
  });

  it('should consume the queue immediately if batching is not enabled', () => {
    const scheduler = new QueryScheduler({
      shouldBatch: false,
      queryManager: queryManager,
    });
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
    const request = {
      options: { query },
      queryId: 'really-fake-id',
    };

    scheduler.queueRequest(request);
    assert.equal(scheduler.fetchRequests.length, 0);
    assert.equal(Object.keys(scheduler.inFlightRequests).length, 1);
  });
});
