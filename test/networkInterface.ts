import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { assign } from 'lodash';

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

// import { print } from 'graphql-tag/printer';

// import { GraphQLResult } from 'graphql';

describe('network interface', () => {
  before(() => {
    this.realFetch = (<any>global)['fetch'];

    (<any>global)['fetch'] = ((url: string, opts: any) => {
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
      //       const response = new (<any>global)['Response'](JSON.stringify(result));
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
    (<any>global)['fetch'] = this.realFetch;
  });

  describe('creating a network interface', () => {
    it('should throw without an endpoint', () => {
      assert.throws(() => {
        createNetworkInterface(null);
      }, /A remote enpdoint is required for a network layer/);
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

      const swapi = createNetworkInterface({ uri: 'http://graphql-swapi.test/' });
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
      const testWare1 = TestWare([], [
        { key: 'planet', val: 'mars' },
      ]);

      const swapi = createNetworkInterface({ uri: 'http://graphql-swapi.test/' });
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
        assert.notOk((<any>swapi._opts)['planet']);
      });
    });

    it('should alter the request body params', () => {
      const testWare1 = TestWare([], [], [
        { key: 'newParam', val: '0123456789' },
      ]);

      const swapi = createNetworkInterface({ uri: 'http://graphql-swapi.test/' });
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

      return swapi.query(simpleRequest).then((data) => {
        return assert.deepEqual(
          JSON.parse(this.lastFetchOpts.body),
          {
            query: 'query people($personNum: Int!) {\n  allPeople(first: $personNum) {\n    people {\n      name\n    }\n  }\n}\n',
            variables: {},
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

      const swapi = createNetworkInterface({ uri: 'http://graphql-swapi.test/' });
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
      const swapi = createNetworkInterface({ uri: 'http://graphql-swapi.test/' });

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

  /* TODO REFACTOR
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
  */
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
