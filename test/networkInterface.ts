import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { assign, isEqual } from 'lodash';
import * as fetchMock from 'fetch-mock';

// make it easy to assert with promises
chai.use(chaiAsPromised);

const { assert, expect } = chai;

import {
  createNetworkInterface,
//  NetworkInterface,
//  Request,
} from '../src/transport/networkInterface';

import {
  MiddlewareRequest,
} from '../src/transport/middleware';

import {
  AfterwareResponse,
} from '../src/transport/afterware';

import gql from 'graphql-tag';

import { print } from 'graphql/language/printer';

import { withWarning } from './util/wrap';

describe('network interface', () => {
  const swapiUrl = 'http://graphql-swapi.test/';
  const missingUrl = 'http://does-not-exist.test/';

  const unauthorizedUrl = 'http://unauthorized.test/';
  const serviceUnavailableUrl = 'http://service-unavailable.test/';

  const simpleQueryWithNoVars = gql`
    query people {
      allPeople(first: 1) {
        people {
          name
        }
      }
    }
  `;

  const simpleQueryWithVar = gql`
    query people($personNum: Int!) {
      allPeople(first: $personNum) {
        people {
          name
        }
      }
    }
  `;

  const simpleResult = {
    data: {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    },
  };

  const complexQueryWithTwoVars = gql`
    query people($personNum: Int!, $filmNum: Int!) {
      allPeople(first: $personNum) {
        people {
          name
          filmConnection(first: $filmNum) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    }
  `;

  const complexResult = {
    data: {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
            filmConnection: {
              edges: [
                {
                  node: {
                    id: 'ZmlsbXM6MQ==',
                  },
                },
              ],
            },
          },
        ],
      },
    },
  };

  // We mock the network interface to return the results that the SWAPI would.
  before(() => {
    // We won't be too careful about counting calls or closely checking
    // parameters, but just do the basic stuff to ensure the request looks right
    fetchMock.post(swapiUrl, (url, opts) => {
      const { query, variables } = JSON.parse((opts as RequestInit).body!.toString());

      if (query === print(simpleQueryWithNoVars)) {
        return simpleResult;
      }

      if (query === print(simpleQueryWithVar)
          && isEqual(variables, { personNum: 1 })) {
        return simpleResult;
      }

      if (query === print(complexQueryWithTwoVars)
          && isEqual(variables, { personNum: 1, filmNum: 1 })) {
        return complexResult;
      }

      throw new Error('Invalid Query');
    });
    fetchMock.post(missingUrl, () => {
      throw new Error('Network error');
    });

    fetchMock.post(unauthorizedUrl, 403);
    fetchMock.post(serviceUnavailableUrl, 503);
  });

  after(() => {
    fetchMock.restore();
  });

  describe('creating a network interface', () => {
    it('should throw without an argument', () => {
      assert.throws(() => {
        createNetworkInterface(undefined as any);
      }, /must pass an options argument/);
    });

    it('should throw without an endpoint', () => {
      assert.throws(() => {
        createNetworkInterface({});
      }, /A remote endpoint is required for a network layer/);
    });

    it('should warn when the endpoint is passed as the first argument', () => {
      return withWarning(() => {
        createNetworkInterface('/graphql');
      }, /Passing the URI as the first argument to createNetworkInterface is deprecated/);
    });

    it('should create an instance with a given uri', () => {
      const networkInterface = createNetworkInterface({ uri: '/graphql' });
      assert.equal(networkInterface._uri, '/graphql');
    });

    it('should allow for storing of custom options', () => {
      const customOpts: RequestInit = {
        headers: { 'Authorizaion': 'working' },
        credentials: 'include',
      };

      const networkInterface = createNetworkInterface({ uri: '/graphql', opts: customOpts });

      assert.deepEqual(networkInterface._opts, assign({}, customOpts));
    });

    it('should not mutate custom options', () => {
      const customOpts: RequestInit = {
        headers: [ 'Authorizaion', 'working' ],
        credentials: 'include',
      };
      const originalOpts = assign({}, customOpts);

      const networkInterface = createNetworkInterface({ uri: '/graphql', opts: customOpts });

      delete customOpts.headers;

      assert.deepEqual(networkInterface._opts, originalOpts);
    });
  });

  describe('middleware', () => {
    it('should throw an error if you pass something bad', () => {
      const malWare: any = {};
      const networkInterface = createNetworkInterface({ uri: '/graphql' });

      try {
        networkInterface.use([malWare]);
        expect.fail();
      } catch (error) {
        assert.equal(
          error.message,
          'Middleware must implement the applyMiddleware function',
        );
      }

    });

    it('should take a middleware and assign it', () => {
      const testWare = TestWare();

      const networkInterface = createNetworkInterface({ uri: '/graphql' });
      networkInterface.use([testWare]);

      assert.equal(networkInterface._middlewares[0], testWare);
    });

    it('should take more than one middleware and assign it', () => {
      const testWare1 = TestWare();
      const testWare2 = TestWare();

      const networkInterface = createNetworkInterface({ uri: '/graphql' });
      networkInterface.use([testWare1, testWare2]);

      assert.deepEqual(networkInterface._middlewares, [testWare1, testWare2]);
    });

    it('should alter the request variables', () => {
      const testWare1 = TestWare([
        { key: 'personNum', val: 1 },
      ]);

      const swapi = createNetworkInterface({ uri: swapiUrl });
      swapi.use([testWare1]);
      // this is a stub for the end user client api
      const simpleRequest = {
        query: simpleQueryWithVar,
        variables: {},
        debugName: 'People query',
      };

      return assert.eventually.deepEqual(
        swapi.query(simpleRequest),
        simpleResult,
      );
    });

    it('should alter the options but not overwrite defaults', () => {
      const testWare1 = TestWare([], [
        { key: 'planet', val: 'mars' },
      ]);

      const swapi = createNetworkInterface({ uri: swapiUrl });
      swapi.use([testWare1]);
      // this is a stub for the end user client api
      const simpleRequest = {
        query: simpleQueryWithNoVars,
        variables: {},
        debugName: 'People query',
      };

      return swapi.query(simpleRequest).then((data) => {
        assert.equal((fetchMock.lastCall()[1] as any).planet, 'mars');
        assert.notOk((<any>swapi._opts)['planet']);
      });
    });

    it('should alter the request body params', () => {
      const testWare1 = TestWare([], [], [
        { key: 'newParam', val: '0123456789' },
      ]);

      const swapi = createNetworkInterface({ uri: 'http://graphql-swapi.test/' });
      swapi.use([testWare1]);
      const simpleRequest = {
        query: simpleQueryWithVar,
        variables: { personNum: 1 },
        debugName: 'People query',
      };

      return swapi.query(simpleRequest).then((data) => {
        return assert.deepEqual(
          JSON.parse((fetchMock.lastCall()[1] as any).body),
          {
            query: 'query people($personNum: Int!) {\n  allPeople(first: $personNum) {\n    people {\n      name\n    }\n  }\n}\n',
            variables: { personNum: 1 },
            debugName: 'People query',
            newParam: '0123456789',
          },
        );
      });
    });

    it('handle multiple middlewares', () => {
      const testWare1 = TestWare([
        { key: 'personNum', val: 1 },
      ]);
      const testWare2 = TestWare([
        { key: 'filmNum', val: 1 },
      ]);

      const swapi = createNetworkInterface({ uri: 'http://graphql-swapi.test/' });
      swapi.use([testWare1, testWare2]);
      // this is a stub for the end user client api
      const simpleRequest = {
        query: complexQueryWithTwoVars,
        variables: {},
        debugName: 'People query',
      };

      return assert.eventually.deepEqual(
        swapi.query(simpleRequest),
        complexResult,
      );
    });

    it('should chain use() calls', () => {
      const testWare1 = TestWare([
        { key: 'personNum', val: 1 },
      ]);
      const testWare2 = TestWare([
        { key: 'filmNum', val: 1 },
      ]);

      const swapi = createNetworkInterface({ uri: swapiUrl });
      swapi.use([testWare1])
        .use([testWare2]);
      const simpleRequest = {
        query: complexQueryWithTwoVars,
        variables: {},
        debugName: 'People query',
      };

      return assert.eventually.deepEqual(
        swapi.query(simpleRequest),
        complexResult,
      );
    });

    it('should chain use() and useAfter() calls', () => {
      const testWare1 = TestWare();
      const testWare2 = TestAfterWare();

      const networkInterface = createNetworkInterface({ uri: swapiUrl });
      networkInterface.use([testWare1])
        .useAfter([testWare2]);
      assert.deepEqual(networkInterface._middlewares, [testWare1]);
      assert.deepEqual(networkInterface._afterwares, [testWare2]);
    });

  });

  describe('afterware', () => {
    it('should return errors thrown in afterwares', () => {
      const networkInterface = createNetworkInterface({ uri: swapiUrl });
      networkInterface.useAfter([{
        applyAfterware() {
          throw Error('Afterware error');
        },
      }]);

      const simpleRequest = {
        query: simpleQueryWithNoVars,
        variables: {},
        debugName: 'People query',
      };

      return assert.isRejected(
        networkInterface.query(simpleRequest),
        Error,
        'Afterware error',
      );
    });
    it('should throw an error if you pass something bad', () => {
      const malWare = TestAfterWare();
      delete malWare.applyAfterware;
      const networkInterface = createNetworkInterface({ uri: '/graphql' });

      try {
        networkInterface.useAfter([malWare]);
        expect.fail();
      } catch (error) {
        assert.equal(
          error.message,
          'Afterware must implement the applyAfterware function',
        );
      }

    });

    it('should take a afterware and assign it', () => {
      const testWare = TestAfterWare();

      const networkInterface = createNetworkInterface({ uri: '/graphql' });
      networkInterface.useAfter([testWare]);

      assert.equal(networkInterface._afterwares[0], testWare);
    });

    it('should take more than one afterware and assign it', () => {
      const testWare1 = TestAfterWare();
      const testWare2 = TestAfterWare();

      const networkInterface = createNetworkInterface({ uri: '/graphql' });
      networkInterface.useAfter([testWare1, testWare2]);

      assert.deepEqual(networkInterface._afterwares, [testWare1, testWare2]);
    });

    it('should chain useAfter() calls', () => {
      const testWare1 = TestAfterWare();
      const testWare2 = TestAfterWare();

      const networkInterface = createNetworkInterface({ uri: '/graphql' });
      networkInterface.useAfter([testWare1])
        .useAfter([testWare2]);

      assert.deepEqual(networkInterface._afterwares, [testWare1, testWare2]);
    });

    it('should chain useAfter() and use() calls', () => {
      const testWare1 = TestAfterWare();
      const testWare2 = TestWare();

      const networkInterface = createNetworkInterface({ uri: swapiUrl });
      networkInterface.useAfter([testWare1])
        .use([testWare2]);
      assert.deepEqual(networkInterface._middlewares, [testWare2]);
      assert.deepEqual(networkInterface._afterwares, [testWare1]);
    });

  });

  describe('making a request', () => {
    // this is a stub for the end user client api
    const doomedToFail = {
      query: simpleQueryWithNoVars,
      variables: {},
      debugName: 'People Query',
    };

    it('should fetch remote data', () => {
      const swapi = createNetworkInterface({ uri: swapiUrl });

      // this is a stub for the end user client api
      const simpleRequest = {
        query: simpleQueryWithNoVars,
        variables: {},
        debugName: 'People query',
      };

      return assert.eventually.deepEqual(
        swapi.query(simpleRequest),
        simpleResult,
      );
    });

    it('should throw on a network error', () => {
      const nowhere = createNetworkInterface({ uri: missingUrl });

      return assert.isRejected(nowhere.query(doomedToFail));
    });

    it('should throw an error with the response when request is forbidden', () => {
      const unauthorizedInterface = createNetworkInterface({ uri: unauthorizedUrl });

      return unauthorizedInterface.query(doomedToFail).catch(err => {
        assert.isOk(err.response);
        assert.equal(err.response.status, 403);
        assert.equal(err.message, 'Network request failed with status 403 - "Forbidden"');
      });
    });

    it('should throw an error with the response when service is unavailable', () => {
      const unauthorizedInterface = createNetworkInterface({ uri: serviceUnavailableUrl });

      return unauthorizedInterface.query(doomedToFail).catch(err => {
        assert.isOk(err.response);
        assert.equal(err.response.status, 503);
        assert.equal(err.message, 'Network request failed with status 503 - "Service Unavailable"');
      });
    });
  });
});

// simulate middleware by altering variables and options
function TestWare(
  variables: Array<{ key: string, val: any }> = [],
  options: Array<{ key: string, val: any }> = [],
  bodyParams: Array<{ key: string, val: any }> = [],
) {

  return {
    applyMiddleware: (request: MiddlewareRequest, next: Function): void => {
      variables.map((variable) => {
        (<any>request.request.variables)[variable.key] = variable.val;
      });

      options.map((variable) => {
        (<any>request.options)[variable.key] = variable.val;
      });

      bodyParams.map((param) => {
        request.request[param.key as string] = param.val;
      });

      next();
    },
  };
}

// simulate afterware by altering variables and options
function TestAfterWare(
  options: Array<{ key: string, val: any }> = [],
) {

  return {
    applyAfterware: (response: AfterwareResponse, next: Function): void => {
      options.map((variable) => {
        (<any>response.options)[variable.key] = variable.val;
      });

      next();
    },
  };
}
