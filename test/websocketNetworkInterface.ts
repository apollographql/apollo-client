import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { assign } from 'lodash';

// make it easy to assert with promises
chai.use(chaiAsPromised);

const { assert, expect } = chai;

import {
  createNetworkInterface,
} from '../src/transport/networkInterface';
import {
  WebsocketNetworkInterface,
} from '../src/transport/websocketNetworkInterface';

import {
  MiddlewareRequest,
} from '../src/transport/middleware';

import {
  AfterwareResponse,
} from '../src/transport/afterware';

import gql from 'graphql-tag';

// import { print } from 'graphql-tag/printer';

const SWAPI_URL = 'ws://localhost:3000/graphql';

describe('reactive network interface', () => {
  describe('creating a network interface', () => {
    it('should throw without an endpoint', () => {
      assert.throws(() => {
        createNetworkInterface(null as any);
      }, /You must pass an options argument to createNetworkInterface./);
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

      const networkInterface = createNetworkInterface({ uri: '/graphql' , opts: customOpts });
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
          'Middleware must implement the applyMiddleware function'
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

      const swapi = createNetworkInterface({ uri: SWAPI_URL });
      swapi.use([testWare1]);
      // this is a stub for the end user client api
      const simpleRequest = {
        query: gql`
          query people($personNum: Int!) {
            allPeople(first: $personNum) {
              people {
                name
              }
            }
          }
        `,
        variables: {},
        debugName: 'People query',
      };

      return assert.eventually.deepEqual(
        swapi.query(simpleRequest),
        {
          data: {
            allPeople: {
              people: [
                {
                  name: 'Luke Skywalker',
                },
              ],
            },
          },
        }
      );
    });

    it('handle multiple middlewares', () => {
      const testWare1 = TestWare([
        { key: 'personNum', val: 1 },
      ]);
      const testWare2 = TestWare([
        { key: 'filmNum', val: 1 },
      ]);

      const swapi = createNetworkInterface({ uri: SWAPI_URL });
      swapi.use([testWare1, testWare2]);
      // this is a stub for the end user client api
      const simpleRequest = {
        query: gql`
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
        `,
        variables: {},
        debugName: 'People query',
      };

      return assert.eventually.deepEqual(
        swapi.query(simpleRequest),
        {
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
        }
      );
    });
  });

  describe('afterware', () => {
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
          'Afterware must implement the applyAfterware function'
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
  });

  describe('making a request', () => {
    it('should fetch remote data', () => {
      const swapi = createNetworkInterface({ uri: SWAPI_URL });

      // this is a stub for the end user client api
      const simpleRequest = {
        query: gql`
          query people {
            allPeople(first: 1) {
              people {
                name
              }
            }
          }
        `,
        variables: {},
        debugName: 'People query',
      };

      return assert.eventually.deepEqual(
        swapi.query(simpleRequest),
        {
          data: {
            allPeople: {
              people: [
                {
                  name: 'Luke Skywalker',
                },
              ],
            },
          },
        }
      );
    });

    it('should throw on a network error', () => {
      const nowhere = createNetworkInterface({ uri: 'http://does-not-exist.test/' });

      // this is a stub for the end user client api
      const doomedToFail = {
        query: gql`
          query people {
            allPeople(first: 1) {
              people {
                name
              }
            }
          }
        `,
        variables: {},
        debugName: 'People Query',
      };

      return assert.isRejected(nowhere.query(doomedToFail));
    });
  });
});

// simulate middleware by altering variables and options
function TestWare(
  variables: Array<{ key: string, val: any }> = [],
  options: Array<{ key: string, val: any }> = [],
  bodyParams: Array<{ key: string, val: any }> = []
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
};

// simulate afterware by altering variables and options
function TestAfterWare(
  options: Array<{ key: string, val: any }> = []
) {

  return {
    applyAfterware: (response: AfterwareResponse, next: Function): void => {
      options.map((variable) => {
        (<any>response.options)[variable.key] = variable.val;
      });

      next();
    },
  };
};
