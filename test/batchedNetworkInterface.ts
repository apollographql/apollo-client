import { assert } from 'chai';

import { merge } from 'lodash';

import * as sinon from 'sinon';

import { HTTPBatchedNetworkInterface } from '../src/transport/batchedNetworkInterface';

import {
  createMockFetch,
  createMockedIResponse,
} from './mocks/mockFetch';

import {
  Request,
  printRequest,
} from '../src/transport/networkInterface';

import { BatchMiddlewareInterface } from '../src/transport/middleware';
import { BatchAfterwareInterface } from '../src/transport/afterware';

import { ExecutionResult } from 'graphql';

import gql from 'graphql-tag';

import 'whatwg-fetch';

declare var fetch: any;

describe('HTTPBatchedNetworkInterface', () => {
  // Helper method that tests a roundtrip given a particular set of requests to the
  // batched network interface and the
  const assertRoundtrip = ({
    requestResultPairs,
    fetchFunc,
    middlewares = [],
    afterwares = [],
    opts = {},
  }: {
    requestResultPairs: {
      request: Request,
      result: ExecutionResult,
    }[];
    fetchFunc?: any;
    middlewares?: BatchMiddlewareInterface[];
    afterwares?: BatchAfterwareInterface[];
    opts?: RequestInit,
  }) => {
    const url = 'http://fake.com/graphql';
    const batchedNetworkInterface = new HTTPBatchedNetworkInterface(url, 10, opts);

    batchedNetworkInterface.use(middlewares);
    batchedNetworkInterface.useAfter(afterwares);

    const printedRequests: Array<any> = [];
    const resultList: Array<any> = [];
    requestResultPairs.forEach(({ request, result }) => {
      printedRequests.push(printRequest(request));
      resultList.push(result);
    });

    fetch = fetchFunc || createMockFetch({
      url,
      opts: merge({
        body: JSON.stringify(printedRequests),
        headers:  {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }, opts),
      result: createMockedIResponse(resultList),
    });

    return batchedNetworkInterface.batchQuery(requestResultPairs.map(({ request }) => request))
      .then((results) => {
        assert.deepEqual(results, resultList);
      });
  };

  // Some helper queries + results
  const authorQuery = gql`
    query {
      author {
        firstName
        lastName
      }
    }`;

  const authorResult = {
    data: {
      author: {
        firstName: 'John',
        lastName: 'Smith',
      },
    },
  };

  const personQuery = gql`
    query {
      person {
        name
      }
    }`;
  const personResult = {
    data: {
      person: {
        name: 'John Smith',
      },
    },
  };

  it('should construct itself correctly', () => {
    const url = 'http://notreal.com/graphql';
    const opts = {};
    const batchedNetworkInterface = new HTTPBatchedNetworkInterface(url, 10, opts);
    assert(batchedNetworkInterface);
    assert.equal(batchedNetworkInterface._uri, url);
    assert.deepEqual(batchedNetworkInterface._opts, opts);
    assert(batchedNetworkInterface.batchQuery);
  });

  it('should correctly return the result for a single request', () => {
    return assertRoundtrip({
      requestResultPairs: [{
        request: { query: authorQuery },
        result: authorResult,
      }],
    });
  });

  it('should correctly return the results for multiple requests', () => {
    return assertRoundtrip({
      requestResultPairs: [
        {
          request: { query: authorQuery },
          result: authorResult,
        },
        {
          request: { query: personQuery },
          result: personResult,
        },
      ],
    });
  });

  it('should correctly execute middleware once per batch request', () => {
    const middlewareCallCounter = sinon.stub();

    return assertRoundtrip({
      requestResultPairs: [
        {
          request: { query: authorQuery },
          result: authorResult,
        },
        {
          request: { query: personQuery },
          result: personResult,
        },
      ],
      middlewares: [{
        applyBatchMiddleware(req, next) {
          middlewareCallCounter();

          next();
        },
      }],
    })
    .then(() => {
      assert.equal(middlewareCallCounter.callCount, 1);
    });
  });

  it('should correctly execute afterware once per batch request', () => {
    const afterwareCallCounter = sinon.stub();

    return assertRoundtrip({
      requestResultPairs: [
        {
          request: { query: authorQuery },
          result: authorResult,
        },
        {
          request: { query: personQuery },
          result: personResult,
        },
      ],
      afterwares: [{
        applyBatchAfterware({ responses }, next) {
          afterwareCallCounter();

          next();
        },
      }],
    })
    .then(() => {
      assert.equal(afterwareCallCounter.callCount, 1);
    });
  });

  describe('errors', () => {
    it('should return errors thrown by fetch', (done) => {
      const err = new Error('Error of some kind thrown by fetch.');
      const fetchFunc = () => { throw err; };
      assertRoundtrip({
        requestResultPairs: [{
          request: { query: authorQuery },
          result: authorResult,
        }],
        fetchFunc,
      }).then(() => {
        done(new Error('Assertion passed when it should not have.'));
      }).catch((error) => {
        assert(error);
        assert.deepEqual(error, err);
        done();
      });
    });

    it('should throw an error with the response when a non-200 response is received', (done) => {
      const fakeForbiddenResponse = createMockedIResponse([], { status: 401, statusText: 'Unauthorized'});
      const fetchFunc = () => Promise.resolve(fakeForbiddenResponse);

      assertRoundtrip({
        requestResultPairs: [{
          request: { query: authorQuery },
          result: authorResult,
        }],
        fetchFunc,
      }).then(() => {
        done(new Error('An error should have been thrown'));
      }).catch(err => {
        assert.strictEqual(err.response, fakeForbiddenResponse, 'Incorrect response provided');
        assert.equal(err.message, 'Network request failed with status 401 - "Unauthorized"', 'Incorrect message generated');
        done();
      });
    });

    it('should return errors thrown by middleware', (done) => {
      const err = new Error('Error of some kind thrown by middleware.');
      const errorMiddleware: BatchMiddlewareInterface = {
        applyBatchMiddleware() {
          throw err;
        },
      };
      assertRoundtrip({
        requestResultPairs: [{
          request: { query: authorQuery },
          result: authorResult,
        }],
        middlewares: [ errorMiddleware ],
      }).then(() => {
        done(new Error('Returned a result when it should not have.'));
      }).catch((error) => {
        assert.deepEqual(error, err);
        done();
      });
    });

    it('should return errors thrown by afterware', (done) => {
      const err = new Error('Error of some kind thrown by afterware.');
      const errorAfterware: BatchAfterwareInterface = {
        applyBatchAfterware() {
          throw err;
        },
      };
      assertRoundtrip({
        requestResultPairs: [{
          request: { query: authorQuery },
          result: authorResult,
        }],
        afterwares: [ errorAfterware ],
      }).then(() => {
        done(new Error('Returned a result when it should not have.'));
      }).catch((error) => {
        assert.deepEqual(error, err);
        done();
      });
    });
  });

  it('middleware should be able to modify requests/options', () => {
    const changeMiddleware: BatchMiddlewareInterface = {
      applyBatchMiddleware({ options }, next) {
        (options as any).headers['Content-Length'] = '18';
        next();
      },
    };

    const customHeaders: { [index: string]: string } = {
      'Content-Length': '18',
    };
    const options = { headers: customHeaders };
    return assertRoundtrip({
      requestResultPairs: [{
        request: { query: authorQuery },
        result: authorResult,
      }],
      opts: options,
      middlewares: [ changeMiddleware ],
    });
  });

  it('opts should be able to modify request headers and method (#920)', () => {
    const customHeaders: { [index: string]: string } = {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'x-www-form-urlencoded',
    };
    const options = { method: 'GET', headers: customHeaders };
    return assertRoundtrip({
      requestResultPairs: [{
        request: { query: authorQuery },
        result: authorResult,
      }],
      opts: options,
    });
  });

  describe('afterware execution', () => {
    const afterwareStub = sinon.stub();
    const testAfterwares: BatchAfterwareInterface[] = [
      {
        applyBatchAfterware(response, next) {
          afterwareStub();
          next();
        },
      },
      {
        applyBatchAfterware(response, next) {
          afterwareStub();
          next();
        },
      },
    ];

    afterEach(() => afterwareStub.reset());

    it('executes afterware when valid responses given back', done => {
      assertRoundtrip({
        requestResultPairs: [{
          request: { query: authorQuery },
          result: authorResult,
        }],
        afterwares: testAfterwares,
      }).then(() => {
        assert.equal(afterwareStub.callCount, testAfterwares.length, 'Afterwares provided were not invoked');
        done();
      }).catch(err => {
        done(err);
      });
    });

    it('executes afterware when an invalid response is given back', done => {
      const fakeForbiddenResponse = createMockedIResponse([], { status: 401, statusText: 'Unauthorized'});
      const fetchFunc = () => Promise.resolve(fakeForbiddenResponse);

      assertRoundtrip({
        requestResultPairs: [{
          request: { query: authorQuery },
          result: authorResult,
        }],
        fetchFunc,
        afterwares: testAfterwares,
      }).then(() => {
        done(new Error('The networkInterface did not reject as expected'));
      }).catch(err => {
        assert.equal(afterwareStub.callCount, testAfterwares.length, 'Afterwares provided were not invoked');
        done();
      });
    });
  });
});
