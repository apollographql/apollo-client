import { QueryBatcher,
         QueryFetchRequest,
       } from '../src/batching';
import { assert } from 'chai';
import mockNetworkInterface, {
  mockBatchedNetworkInterface,
} from './mocks/mockNetworkInterface';
import gql from 'graphql-tag';
import { GraphQLResult } from 'graphql';

const networkInterface = mockNetworkInterface();

describe('QueryBatcher', () => {
  it('should construct', () => {
    assert.doesNotThrow(() => {
      const querySched = new QueryBatcher({
        shouldBatch: true,
        networkInterface,
      });
      querySched.consumeQueue();
    });
  });

  it('should not do anything when faced with an empty queue', () => {
    const batcher = new QueryBatcher({
      shouldBatch: true,
      networkInterface,
    });

    assert.equal(batcher.queuedRequests.length, 0);
    batcher.consumeQueue();
    assert.equal(batcher.queuedRequests.length, 0);
  });

  it('should be able to add to the queue', () => {
    const batcher = new QueryBatcher({
      shouldBatch: true,
      networkInterface,
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
      }
    );
    const batcher = new QueryBatcher({
      shouldBatch: true,
      networkInterface: myNetworkInterface,
    });
    const request: QueryFetchRequest = {
      options: { query },
      queryId: 'not-a-real-id',
    };

    it('should be able to consume from a queue containing a single query', (done) => {
      const myBatcher = new QueryBatcher({
        shouldBatch: true,
        networkInterface: myNetworkInterface,
      });

      myBatcher.enqueueRequest(request);
      const promises: Promise<GraphQLResult>[] = myBatcher.consumeQueue();
      assert.equal(promises.length, 1);
      promises[0].then((resultObj) => {
        assert.equal(myBatcher.queuedRequests.length, 0);
        assert.deepEqual(resultObj, { data } );
        done();
      });
    });

    it('should be able to consume from a queue containing multiple queries', (done) => {
      const request2 = {
        options: { query },
        queryId: 'another-fake-id',
      };
      const myBatcher = new QueryBatcher({
        shouldBatch: true,
        networkInterface: mockBatchedNetworkInterface(
          {
            request: { query },
            result: {data },
          },
          {
            request: { query },
            result: { data },
          }
        ),
      });
      myBatcher.enqueueRequest(request);
      myBatcher.enqueueRequest(request2);
      const promises: Promise<GraphQLResult>[] = myBatcher.consumeQueue();
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
      const myBatcher = new QueryBatcher({
        shouldBatch: true,
        networkInterface: mockBatchedNetworkInterface(
          {
            request: { query },
            result: { data },
          }
        ),
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
      shouldBatch: true,
      networkInterface,
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

    batcher.enqueueRequest(request);
    batcher.enqueueRequest(request);

    //poll with a big interval so that the queue
    //won't actually be consumed by the time we stop.
    batcher.start(1000);
    batcher.stop();
    assert.equal(batcher.queuedRequests.length, 2);
  });

  it('should resolve the promise returned when we enqueue with shouldBatch: false', (done) => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
    const myRequest = {
      options: { query },
      queryId: 'not-a-real-id',
    };

    const data = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const myNetworkInterface = mockNetworkInterface(
      {
        request: { query },
        result: { data },
      }
    );
    const batcher = new QueryBatcher({
      shouldBatch: false,
      networkInterface: myNetworkInterface,
    });
    const promise = batcher.enqueueRequest(myRequest);
    batcher.consumeQueue();
    promise.then((result) => {
      assert.deepEqual(result, { data });
      done();
    });
  });

  it('should immediately consume the queue when we enqueue with shouldBatch: false', (done) => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
    const myRequest = {
      options: { query },
      queryId: 'not-a-real-id',
    };

    const data = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const myNetworkInterface = mockNetworkInterface(
      {
        request: { query },
        result: { data },
      }
    );
    const batcher = new QueryBatcher({
      shouldBatch: false,
      networkInterface: myNetworkInterface,
    });
    const promise = batcher.enqueueRequest(myRequest);
    promise.then((result) => {
      assert.deepEqual(result, { data });
      done();
    });
  });

  it('should reject the promise if there is a network error with batch:true', (done) => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
    const request = {
      options: { query },
      queryId: 'very-real-id',
    };
    const error = new Error('Network error');
    const myNetworkInterface = mockBatchedNetworkInterface(
      {
        request: { query },
        error,
      }
    );
    const batcher = new QueryBatcher({
      shouldBatch: true,
      networkInterface: myNetworkInterface,
    });
    const promise = batcher.enqueueRequest(request);
    batcher.consumeQueue();
    promise.catch((resError: Error) => {
      assert.equal(resError.message, 'Network error');
      done();
    });
  });

  it('should reject the promise if there is a network error with batch:false', (done) => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
    const request = {
      options: { query },
      queryId: 'super-real-id',
    };
    const error = new Error('Network error');
    const myNetworkInterface = mockNetworkInterface(
      {
        request: { query },
        error,
      }
    );
    const batcher = new QueryBatcher({
      shouldBatch: false,
      networkInterface: myNetworkInterface,
    });
    const promise = batcher.enqueueRequest(request);
    batcher.consumeQueue();
    promise.catch((resError: Error) => {
      assert.equal(resError.message, 'Network error');
      done();
    });
  });

  it('should not start polling if shouldBatch is false', (done) => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
     }`;
    const fetchRequest = {
      options: { query },
      queryId: 'super-real-id',
    };
    const batcher = new QueryBatcher({
      shouldBatch: false,
      networkInterface: mockNetworkInterface({
        request: { query },
      }),
    });
    batcher.start(1);
    batcher.queuedRequests.push(fetchRequest);
    setTimeout(() => {
      assert.equal(batcher.queuedRequests.length, 1);
      done();
    });
  });
});
