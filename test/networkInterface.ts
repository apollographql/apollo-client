import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { assign } from 'lodash';
import isequal = require('lodash.isequal');
import * as fetchMock from 'fetch-mock';

// make it easy to assert with promises
chai.use(chaiAsPromised);

const { assert, expect } = chai;

import {
  createNetworkInterface,
  addQueryMerging,
  NetworkInterface,
  Request,
} from '../src/transport/networkInterface';

import {
  MiddlewareRequest,
} from '../src/transport/middleware';

import {
  AfterwareResponse,
} from '../src/transport/afterware';

import gql from 'graphql-tag';

import { print } from 'graphql-tag/printer';

import { GraphQLResult } from 'graphql';

describe('network interface', () => {
  const swapiUrl = 'http://graphql-swapi.test/';
  const missingUrl = 'http://does-not-exist.test/';

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
      const { query, variables } = JSON.parse((opts as RequestInit).body.toString());

      if (query === print(simpleQueryWithNoVars)) {
        return simpleResult;
      }

      if (query === print(simpleQueryWithVar)
          && isequal(variables, { personNum: 1 })) {
        return simpleResult;
      }

      if (query === print(complexQueryWithTwoVars)
          && isequal(variables, { personNum: 1, filmNum: 1 })) {
        return complexResult;
      }

      throw new Error('Invalid Query');
    });
    fetchMock.post(missingUrl, Promise.reject('Network error'));
  });

  after(() => {
    fetchMock.restore();
  });

  describe('creating a network interface', () => {
    it('should throw without an endpoint', () => {
      assert.throws(() => {
        createNetworkInterface(null);
      }, /A remote enpdoint is required for a network layer/);
    });

    it('should create an instance with a given uri', () => {
      const networkInterface = createNetworkInterface('/graphql');
      assert.equal(networkInterface._uri, '/graphql');
    });

    it('should allow for storing of custom options', () => {
      const customOpts: RequestInit = {
        headers: { 'Authorizaion': 'working' },
        credentials: 'include',
      };

      const networkInterface = createNetworkInterface('/graphql', customOpts);

      assert.deepEqual(networkInterface._opts, assign({}, customOpts));
    });

    it('should not mutate custom options', () => {
      const customOpts: RequestInit = {
        headers: [ 'Authorizaion', 'working' ],
        credentials: 'include',
      };
      const originalOpts = assign({}, customOpts);

      const networkInterface = createNetworkInterface('/graphql', customOpts);

      delete customOpts.headers;

      assert.deepEqual(networkInterface._opts, originalOpts);
    });
  });

  describe('middleware', () => {
    it('should throw an error if you pass something bad', () => {
      const malWare: any = {};
      const networkInterface = createNetworkInterface('/graphql');

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

      const networkInterface = createNetworkInterface('/graphql');
      networkInterface.use([testWare]);

      assert.equal(networkInterface._middlewares[0], testWare);
    });

    it('should take more than one middleware and assign it', () => {
      const testWare1 = TestWare();
      const testWare2 = TestWare();

      const networkInterface = createNetworkInterface('/graphql');
      networkInterface.use([testWare1, testWare2]);

      assert.deepEqual(networkInterface._middlewares, [testWare1, testWare2]);
    });

    it('should alter the request variables', () => {
      const testWare1 = TestWare([
        { key: 'personNum', val: 1 },
      ]);

      const swapi = createNetworkInterface(swapiUrl);
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

      const swapi = createNetworkInterface(swapiUrl);
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

      const swapi = createNetworkInterface('http://graphql-swapi.test/');
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
          }
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

      const swapi = createNetworkInterface('http://graphql-swapi.test/');
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
  });

  describe('afterware', () => {
    it('should throw an error if you pass something bad', () => {
      const malWare = TestAfterWare();
      delete malWare.applyAfterware;
      const networkInterface = createNetworkInterface('/graphql');

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

      const networkInterface = createNetworkInterface('/graphql');
      networkInterface.useAfter([testWare]);

      assert.equal(networkInterface._afterwares[0], testWare);
    });

    it('should take more than one afterware and assign it', () => {
      const testWare1 = TestAfterWare();
      const testWare2 = TestAfterWare();

      const networkInterface = createNetworkInterface('/graphql');
      networkInterface.useAfter([testWare1, testWare2]);

      assert.deepEqual(networkInterface._afterwares, [testWare1, testWare2]);
    });
  });

  describe('making a request', () => {
    it('should fetch remote data', () => {
      const swapi = createNetworkInterface(swapiUrl);

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
      const nowhere = createNetworkInterface(missingUrl);

      // this is a stub for the end user client api
      const doomedToFail = {
        query: simpleQueryWithNoVars,
        variables: {},
        debugName: 'People Query',
      };

      return assert.isRejected(nowhere.query(doomedToFail));
    });
  });

  describe('query merging', () => {
    it('should merge together queries when we call batchQuery()', (done) => {
      const query1 = gql`
        query authorStuff {
          author {
            name
          }
        }`;
      const query2 = gql`
        query cookieStuff {
          fortuneCookie
        }`;
      const composedQuery = gql`
        query ___composed {
          ___authorStuff___requestIndex_0___fieldIndex_0: author {
            name
          }
          ___cookieStuff___requestIndex_1___fieldIndex_0: fortuneCookie
        }`;
      const request1 = { query: query1 };
      const request2 = { query: query2 };

      const myNetworkInterface: NetworkInterface = {
        query(request: Request): Promise<GraphQLResult> {
          assert.equal(print(request.query), print(composedQuery));
          done();
          return new Promise((resolve, reject) => {
            // never resolve
          });
        },
      };
      const mergingNetworkInterface = addQueryMerging(myNetworkInterface);
      mergingNetworkInterface.batchQuery([request1, request2]);
    });

    it('should unpack merged query results when we call batchQuery()', (done) => {
      const query1 = gql`
        query authorStuff {
          author {
            name
          }
        }`;
      const query2 = gql`
        query cookieStuff {
          fortuneCookie
        }`;
      const composedQuery = gql`
        query ___composed {
          ___authorStuff___requestIndex_0___fieldIndex_0: author {
            name
          }
          ___cookieStuff___requestIndex_1___fieldIndex_0: fortuneCookie
        }`;
      const fortune = 'No snowflake in an avalanche feels responsible.';
      const result1 = {
        data: {
          author: {
            name: 'John Smith',
          },
        },
      };
      const result2 = {
        data: {
          fortuneCookie: fortune,
        },
      };
      const composedResult = {
        data: {
          ___authorStuff___requestIndex_0___fieldIndex_0: {
            name: 'John Smith',
          },
          ___cookieStuff___requestIndex_1___fieldIndex_0: fortune,
        },
      };
      const request1 = { query: query1 };
      const request2 = { query: query2 };

      const myNetworkInterface: NetworkInterface = {
        query(request: Request): Promise<GraphQLResult> {
          assert.equal(print(request.query), print(composedQuery));
          return Promise.resolve(composedResult);
        },
      };
      const mergingNetworkInterface = addQueryMerging(myNetworkInterface);
      mergingNetworkInterface.batchQuery([request1, request2]).then((results) => {
        assert.equal(results.length, 2);
        assert.deepEqual(results[0], result1);
        assert.deepEqual(results[1], result2);
        done();
      });
    });

    it('should not merge queries when batchQuery is passed a single query', () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }`;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const request = { query: query };
      const myNetworkInterface: NetworkInterface = {
        query(requestReceived: Request): Promise<GraphQLResult> {
          assert.equal(print(requestReceived.query), print(query));
          return Promise.resolve({ data });
        },
      };
      const mergingNetworkInterface = addQueryMerging(myNetworkInterface);
      mergingNetworkInterface.batchQuery([request]).then((results) => {
        assert.equal(results.length, 1);
        assert.deepEqual(results[0], { data });
      });
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
