import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { assign } from 'lodash';

// make it easy to assert with promises
chai.use(chaiAsPromised);

const { assert, expect } = chai;

import {
  createNetworkInterface,
} from '../src/networkInterface';

import {
  MiddlewareRequest,
} from '../src/middleware';

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
        query: `
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
        query: `
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
        query: `
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
        query: `
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

    it('should return errors if the server responds with them', () => {
      const swapi = createNetworkInterface('http://graphql-swapi.test/');

      // this is a stub for the end user client api
      const simpleRequest = {
        query: `
          query people {
            allPeople(first: 1) {
              people {
                name
              }
          }
        `,
        variables: {},
        debugName: 'People query',
      };

      return assert.eventually.deepEqual(
        swapi.query(simpleRequest),
        {
          errors: [
            {
              message: 'Syntax Error GraphQL request (8:9) Expected Name, found EOF\n\n7:           }\n8:         \n           ^\n',
              locations: [
                {
                  column: 9,
                  line: 8,
                },
              ],
            },
          ],
        }
      );
    });

    it('should throw on a network error', () => {
      const nowhere = createNetworkInterface('http://does-not-exist.test/');

      // this is a stub for the end user client api
      const doomedToFail = {
        query: `
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
