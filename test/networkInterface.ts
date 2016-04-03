import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { assign } from 'lodash';

// make it easy to assert with promises
chai.use(chaiAsPromised);

const { assert } = chai;

import {
  createNetworkInterface,
  NetworkInterface,
} from '../src/networkInterface';

describe('network interface', () => {
  describe('creating a network interface', () => {
    it('should throw without an endpoint', () => {
      assert.throws(() => {
        createNetworkInterface(null);
      }, /A remote enpdoint is required for a network layer/);
    });

    it('should create an instance with a given uri', () => {
      const networkInterface: NetworkInterface = createNetworkInterface('/graphql');
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
  });

  describe('making a request', () => {
    it('should fetch remote data', () => {
      const swapi = createNetworkInterface('http://graphql-swapi.parseapp.com/');

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
      const swapi = createNetworkInterface('http://graphql-swapi.parseapp.com/');

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
                  line: 8,
                  column: 9,
                },
              ],
            },
          ],
        }
      );
    });

    it('should throw on a network error', () => {
      const nowhere = createNetworkInterface('http://does-not-exist.parseapp.com/');

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

function TestWare() {
  // code
}
