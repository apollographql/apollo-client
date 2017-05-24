import { assert } from 'chai';

import gql from 'graphql-tag';

import * as sinon from 'sinon';

import {
  createHybridNetworkInterface,
  HTTPHybridNetworkInterface,
} from '../src/transport/hybridNetworkInterface';

describe('HTTPHybridNetworkInterface', () => {
  // Some helper queries + results
  const authorQuery = gql`
    query {
      author {
        firstName
        lastName
      }
    }`;

  const uri = 'http://notreal.com/graphql';
  const opts = {};

  it('should construct itself correctly', () => {
    const hybridNetworkInterface = createHybridNetworkInterface({ uri, batchInterval: 10, opts });
    assert(hybridNetworkInterface);
    assert.equal(hybridNetworkInterface._uri, uri);
    assert.deepEqual(hybridNetworkInterface._opts, opts);
    assert(hybridNetworkInterface.batchedInterface.batchQuery);
    assert(hybridNetworkInterface.networkInterface);
  });

  it('should use the network interface when batch is disabled', () => {
    const simpleRequest = {
      query: authorQuery,
      variables: {},
      disableBatch: true,
    };

    const hybridNetworkInterface = createHybridNetworkInterface({ uri, batchInterval: 10, opts });
    sinon.spy(hybridNetworkInterface.networkInterface, 'query');
    sinon.spy(hybridNetworkInterface.batchedInterface, 'query');
    hybridNetworkInterface.query(simpleRequest);
    assert(hybridNetworkInterface.networkInterface.query.calledOnce);
    assert.isFalse(hybridNetworkInterface.batchedInterface.query.calledOnce);
  });

  it('should use the batch interface by default', () => {
    const simpleRequest = {
      query: authorQuery,
      variables: {},
    };

    const hybridNetworkInterface = createHybridNetworkInterface({ uri, batchInterval: 10, opts });
    sinon.spy(hybridNetworkInterface.networkInterface, 'query');
    sinon.spy(hybridNetworkInterface.batchedInterface, 'query');
    hybridNetworkInterface.query(simpleRequest);
    assert.isFalse(hybridNetworkInterface.networkInterface.query.calledOnce);
    assert(hybridNetworkInterface.batchedInterface.query.calledOnce);
  });

  it('should take a middleware and assign it', () => {
    const middleware = {
      applyMiddleware(req: any, next: any) {
        next();
      },
      applyBatchMiddleware(req: any, next: any) {
        next();
      },
    };

    const hybridNetworkInterface = createHybridNetworkInterface({ uri, batchInterval: 10, opts });
    hybridNetworkInterface.use([middleware]);
    assert.equal(hybridNetworkInterface.networkInterface._middlewares[0], middleware);
    assert.equal(hybridNetworkInterface.batchedInterface._middlewares[0], middleware);
  });

  it('should chain middleware and afterware', () => {
    const middleware = {
      applyMiddleware(req: any, next: any) {
        next();
      },
      applyBatchMiddleware(req: any, next: any) {
        next();
      },
    };

    const afterware = {
      applyAfterware(req: any, next: any) {
        next();
      },
      applyBatchAfterware(req: any, next: any) {
        next();
      },
    };

    const hybridNetworkInterface = createHybridNetworkInterface({ uri, batchInterval: 10, opts });
    hybridNetworkInterface.use([middleware]).useAfter([afterware]);
    assert.equal(hybridNetworkInterface.networkInterface._middlewares[0], middleware);
    assert.equal(hybridNetworkInterface.batchedInterface._middlewares[0], middleware);
    assert.equal(hybridNetworkInterface.networkInterface._afterwares[0], afterware);
    assert.equal(hybridNetworkInterface.batchedInterface._afterwares[0], afterware);
  });
});

