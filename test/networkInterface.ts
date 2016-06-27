import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { assign } from 'lodash';

// make it easy to assert with promises
chai.use(chaiAsPromised);

const { assert, expect } = chai;

import {
  createNetworkInterface,
  addQueryMerging,
  NetworkInterface,
  Request,
} from '../src/networkInterface';

import {
  MiddlewareRequest,
} from '../src/middleware';

import gql from 'graphql-tag';

import { print } from 'graphql/language/printer';

import { GraphQLResult } from 'graphql';

// import {
//   graphql,
// } from 'graphql';

/* tslint:disable */
// const swapiSchema = require('swapi-graphql').schema;
/* tslint:enable */

describe('network interface', () => {
  before(() => {
    this.realFetch = global['fetch'];

    global['fetch'] = ((url, opts) => {
      this.lastFetchOpts = opts;
      if (url === 'http://does-not-exist.test/') {
        return Promise.reject('Network error');
      }

      if (url === 'http://graphql-swapi.test/') {
        url = 'http://graphql-swapi.parseapp.com/';
      }

      // XXX swapi graphql NPM package is broken now
      // else if (url === 'http://graphql-swapi.test/') {
      //   return new Promise((resolve, reject) => {
      //     const request = JSON.parse(opts.body);
      //     graphql(swapiSchema, request.query, undefined, request.variables).then(result => {
      //       const response = new global['Response'](JSON.stringify(result));
      //       resolve(response);
      //     }).catch(error => {
      //       reject(error);
      //     });
      //   });
      // }

      return this.realFetch(url, opts);
    });
  });

  after(() => {
    global['fetch'] = this.realFetch;
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
      const malWare = new TestWare();
      delete malWare.applyMiddleware;
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
      const testWare = new TestWare();

      const networkInterface = createNetworkInterface('/graphql');
      networkInterface.use([testWare]);

      assert.equal(networkInterface._middlewares[0], testWare);
    });

    it('should take more than one middleware and assign it', () => {
      const testWare1 = new TestWare();
      const testWare2 = new TestWare();

      const networkInterface = createNetworkInterface('/graphql');
      networkInterface.use([testWare1, testWare2]);

      assert.deepEqual(networkInterface._middlewares, [testWare1, testWare2]);
    });

    it('should alter the request', () => {
      const testWare1 = new TestWare([
        { key: 'personNum', val: 1 },
      ]);

      const swapi = createNetworkInterface('http://graphql-swapi.test/');
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

    it('should alter the options but not overwrite defaults', () => {
      const testWare1 = new TestWare([], [
        { key: 'planet', val: 'mars' },
      ]);

      const swapi = createNetworkInterface('http://graphql-swapi.test/');
      swapi.use([testWare1]);
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

      return swapi.query(simpleRequest).then((data) => {
        assert.equal(this.lastFetchOpts.planet, 'mars');
        assert.notOk(swapi._opts['planet']);
      });
    });

    it('handle multiple middlewares', () => {
      const testWare1 = new TestWare([
        { key: 'personNum', val: 1 },
      ]);
      const testWare2 = new TestWare([
        { key: 'filmNum', val: 1 },
      ]);

      const swapi = createNetworkInterface('http://graphql-swapi.test/');
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

  describe('making a request', () => {
    it('should fetch remote data', () => {
      const swapi = createNetworkInterface('http://graphql-swapi.test/');

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
      const nowhere = createNetworkInterface('http://does-not-exist.test/');

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
  });
});

// simulate middleware by altering variables and options
function TestWare(
  variables: Array<{ key: string, val: any }> = [],
  options: Array<{ key: string, val: any }> = []
) {

  this.applyMiddleware = (request: MiddlewareRequest, next: Function): void => {
    variables.map((variable) => {
      request.request.variables[variable.key] = variable.val;
    });

    options.map((variable) => {
      request.options[variable.key] = variable.val;
    });

    next();
  };

}
