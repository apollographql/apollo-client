import { assert } from 'chai';

import merge = require('lodash.merge');

import { HTTPBatchedNetworkInterface } from '../src/transport/batchedNetworkInterface';

import {
  createMockFetch,
  createMockedIResponse,
} from './mocks/mockFetch';

import {
  Request,
  printRequest,
} from '../src/transport/networkInterface';

import { MiddlewareInterface } from '../src/transport/middleware';
import { AfterwareInterface } from '../src/transport/afterware';

import { GraphQLResult } from 'graphql';

import 'whatwg-fetch';

import gql from 'graphql-tag';

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
      result: GraphQLResult,
    }[];
    fetchFunc?: any;
    middlewares?: MiddlewareInterface[];
    afterwares?: AfterwareInterface[];
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

    it('should return errors thrown by middleware', (done) => {
      const err = new Error('Error of some kind thrown by middleware.');
      const errorMiddleware: MiddlewareInterface = {
        applyMiddleware() {
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
      const errorAfterware: AfterwareInterface = {
        applyAfterware() {
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
    const changeMiddleware: MiddlewareInterface = {
      applyMiddleware({ options }, next) {
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
});
