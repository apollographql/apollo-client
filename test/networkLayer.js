import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

// make it easy to assert with promises
chai.use(chaiAsPromised);

const { assert } = chai;

import NetworkLayer from '../src/networkLayer';

describe('NetworkLayer', () => {
  describe('constructor()', () => {
    it('should throw without an endpoint', () => {
      assert.throws(() => {
        const networkLayer = new NetworkLayer(); // eslint-disable-line no-unused-vars
<<<<<<< 77b78f46d5fba4d880874f20ef2283b3771e837b
      }, /A remote endpoint is required for a newtork layer/);
=======
      }, /A remote enpdoint is required for a newtork layer/);
>>>>>>> started working on network layer following pattern of Relay
    });

    it('should create an instance with a given uri', () => {
      const networkLayer = new NetworkLayer('/graphql');
      assert.equal(networkLayer._uri, '/graphql');
    });

    it('should require uri to be a string', () => {
      assert.throws(() => {
        const networkLayer = new NetworkLayer(true); // eslint-disable-line no-unused-vars
      }, /Uri must be a string/);
    });

    it('should allow for storing of custom options', () => {
      const customOpts = {
        headers: { TestHeader: 'working' },
        credentials: 'include',
      };

      const networkLayer = new NetworkLayer('/graphql', { ...customOpts });

      assert.deepEqual(networkLayer._opts, { ...customOpts });
    });

    it('should not mutate custom options', () => {
      const customOpts = {
        headers: { TestHeader: 'working' },
        credentials: 'include',
      };
      const originalOpts = { ...customOpts };

      const networkLayer = new NetworkLayer('/graphql', customOpts);

      delete customOpts.headers;

      assert.deepEqual(networkLayer._opts, originalOpts);
    });
  });

  describe('making a request', () => {
    it('should fetch remote data', (done) => {
      const Swapi = new NetworkLayer('http://graphql-swapi.parseapp.com/');

      // this is a stub for the end user client api
      const simpleRequest = {
        getQueryString() {
          return `
            query people {
              allPeople(first: 1) {
                people {
                  name
                }
              }
            }
          `;
        },
        getVariables() { return {}; },
        getDebugName() { return 'People query'; },
      };

      assert.eventually.deepEqual(
<<<<<<< 77b78f46d5fba4d880874f20ef2283b3771e837b
        Swapi.query([simpleRequest]),
=======
        Swapi.query(simpleRequest),
>>>>>>> started working on network layer following pattern of Relay
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
      ).notify(done);
    });

    it('should throw an error if the request fails', (done) => {
      const Swapi = new NetworkLayer('http://graphql-swapi.parseapp.com/');

      // this is a stub for the end user client api
      const simpleRequest = {
        getQueryString() {
          return `
            query people {
              allPeople(first: 1) {
                people {
                  name
                }
            }
          `;
        },
        getVariables() { return {}; },
        getDebugName() { return 'People query'; },
      };

<<<<<<< 77b78f46d5fba4d880874f20ef2283b3771e837b
      assert.isRejected(Swapi.query([simpleRequest]), /Server request for query/)
=======
      assert.isRejected(Swapi.query(simpleRequest), /Server request for query/)
>>>>>>> started working on network layer following pattern of Relay
        .notify(done);
    });

    it('should allow for multiple requests at once', (done) => {
      const Swapi = new NetworkLayer('http://graphql-swapi.parseapp.com/');

      // this is a stub for the end user client api
      const firstRequest = {
        getQueryString() {
          return `
            query people {
              allPeople(first: 1) {
                people {
                  name
                }
              }
            }
          `;
        },
        getVariables() { return {}; },
        getDebugName() { return 'People query'; },
      };

      const secondRequest = {
        getQueryString() {
          return `
            query ships {
              allStarships(first: 1) {
                starships {
                  name
                }
              }
            }
          `;
        },
        getVariables() { return {}; },
        getDebugName() { return 'Ships query'; },
      };

      assert.eventually.deepEqual(
        Swapi.query([firstRequest, secondRequest]),
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
      ).notify(done);
    });
  });
});
