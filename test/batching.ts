import { QueryBatcher,
         QueryFetchRequest,
       } from '../src/transport/batching';
import { assert } from 'chai';
import { Request } from '../src/transport/networkInterface';
import {
  mockBatchedNetworkInterface,
} from './mocks/mockNetworkInterface';
import gql from 'graphql-tag';
import { ExecutionResult } from 'graphql';

const networkInterface = mockBatchedNetworkInterface();

describe('QueryBatcher', () => {
  it('should construct', () => {
    assert.doesNotThrow(() => {
      const querySched = new QueryBatcher({
        batchFetchFunction: networkInterface.batchQuery.bind(networkInterface),
      });
      querySched.consumeQueue();
    });
  });

  it('should not do anything when faced with an empty queue', () => {
    const batcher = new QueryBatcher({
      batchFetchFunction: networkInterface.batchQuery.bind(networkInterface),
    });

    assert.equal(batcher.queuedRequests.length, 0);
    batcher.consumeQueue();
    assert.equal(batcher.queuedRequests.length, 0);
  });

  it('should be able to add to the queue', () => {
    const batcher = new QueryBatcher({
      batchFetchFunction: networkInterface.batchQuery.bind(networkInterface),
    });

    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;

    const request: QueryFetchRequest = {
      request: { query },
    };

    assert.equal(batcher.queuedRequests.length, 0);
    batcher.enqueueRequest(request);
    assert.equal(batcher.queuedRequests.length, 1);
    batcher.enqueueRequest(request);
    assert.equal(batcher.queuedRequests.length, 2);
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
    const myNetworkInterface = mockBatchedNetworkInterface(
      {
        request: { query },
        result: { data },
      },
      {
        request: { query },
        result: { data },
      },
    );
    const batcher = new QueryBatcher({
      batchFetchFunction: myNetworkInterface.batchQuery.bind(myNetworkInterface),
    });
    const request: Request = {
      query,
    };

    it('should be able to consume from a queue containing a single query', (done) => {
      const myBatcher = new QueryBatcher({
        batchFetchFunction: myNetworkInterface.batchQuery.bind(myNetworkInterface),
      });

      myBatcher.enqueueRequest(request);
      const promises: Promise<ExecutionResult>[] = myBatcher.consumeQueue();
      assert.equal(promises.length, 1);
      promises[0].then((resultObj) => {
        assert.equal(myBatcher.queuedRequests.length, 0);
        assert.deepEqual(resultObj, { data } );
        done();
      });
    });

    it('should be able to consume from a queue containing multiple queries', (done) => {
      const request2: Request = {
        query,
      };
      const NI = mockBatchedNetworkInterface(
          {
            request: { query },
            result: {data },
          },
          {
            request: { query },
            result: { data },
          },
        );

      const myBatcher = new QueryBatcher({
        batchFetchFunction: NI.batchQuery.bind(NI),
      });
      myBatcher.enqueueRequest(request);
      myBatcher.enqueueRequest(request2);
      const promises: Promise<ExecutionResult>[] = myBatcher.consumeQueue();
      assert.equal(batcher.queuedRequests.length, 0);
      assert.equal(promises.length, 2);
      promises[0].then((resultObj1) => {
        assert.deepEqual(resultObj1, { data });
        promises[1].then((resultObj2) => {
          assert.deepEqual(resultObj2, { data });
          done();
        });
      });
    });

    it('should return a promise when we enqueue a request and resolve it with a result', (done) => {
      const NI = mockBatchedNetworkInterface(
          {
            request: { query },
            result: { data },
          },
        );
      const myBatcher = new QueryBatcher({
        batchFetchFunction: NI.batchQuery.bind(NI),
      });
      const promise = myBatcher.enqueueRequest(request);
      myBatcher.consumeQueue();
      promise.then((result) => {
        assert.deepEqual(result, { data });
        done();
      });
    });
  });

  it('should be able to stop polling', () => {
    const batcher = new QueryBatcher({
      batchFetchFunction: networkInterface.batchQuery.bind(networkInterface),
    });
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
    const request: Request = {
      query,
    };

    batcher.enqueueRequest(request);
    batcher.enqueueRequest(request);

    //poll with a big interval so that the queue
    //won't actually be consumed by the time we stop.
    batcher.start(1000);
    batcher.stop();
    assert.equal(batcher.queuedRequests.length, 2);
  });

  it('should reject the promise if there is a network error', (done) => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
    const request: Request = {
      query: query,
    };
    const error = new Error('Network error');
    const myNetworkInterface = mockBatchedNetworkInterface(
      {
        request: { query },
        error,
      },
    );
    const batcher = new QueryBatcher({
      batchFetchFunction: myNetworkInterface.batchQuery.bind(myNetworkInterface),
    });
    const promise = batcher.enqueueRequest(request);
    batcher.consumeQueue();
    promise.catch((resError: Error) => {
      assert.equal(resError.message, 'Network error');
      done();
    });
  });
});
