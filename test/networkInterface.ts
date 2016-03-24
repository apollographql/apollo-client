import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { assign } from 'lodash';

// make it easy to assert with promises
chai.use(chaiAsPromised);

const { assert } = chai;

import { createNetworkInterface, NetworkInterface } from '../src/networkInterface';

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
        swapi.query([simpleRequest]),
        [
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
          },
        ]
      );
    });

    it('should throw an error if the request fails', () => {
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

      return assert.isRejected(swapi.query([simpleRequest]), /Server request for query/);
    });

    it('should allow for multiple requests at once', () => {
      const swapi = createNetworkInterface('http://graphql-swapi.parseapp.com/');

      // this is a stub for the end user client api
      const firstRequest = {
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

      const secondRequest = {
        query: `
          query ships {
            allStarships(first: 1) {
              starships {
                name
              }
            }
          }
        `,
        variables: {},
        debugName: 'Ships Query',
      };

      return assert.eventually.deepEqual(
        swapi.query([firstRequest, secondRequest]),
        [
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
          },
          {
            data: {
              allStarships: {
                starships: [
                  {
                    name: 'CR90 corvette',
                  },
                ],
              },
            },
          },
        ]
      );
    });
  });
});
