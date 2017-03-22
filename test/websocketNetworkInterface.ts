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

// XXX: Will require to be move to an online instance.
const SWAPI_URL = 'ws://localhost:3000/graphql';
const SWAPI_HTTP_URL = 'http://localhost:3000/graphql';

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

  describe('sanities', () => {
    it('doesn\'t blow if unsubscribing twice', () => {
      const swapi = createNetworkInterface({ uri: SWAPI_URL });

      // this is a stub for the end user client api
      const simpleRequest = {
        query: gql`
        subscription {
          raisingCount(delay: 10)
        }
        `,
        variables: {},
        debugName: 'raisingCount Subscription',
      };

      const subId = swapi.subscribe(simpleRequest, (e: Error, v: any) => { /* noop */ });
      swapi.unsubscribe(subId);
      swapi.unsubscribe(subId);
    });

    it('throws if no handler given for subscription', () => {
      const swapi = createNetworkInterface({ uri: SWAPI_URL });

      // this is a stub for the end user client api
      const simpleRequest = {
        query: gql`
        subscription {
          raisingCount(delay: 10)
        }
        `,
        variables: {},
        debugName: 'raisingCount Subscription',
      };

      assert.throws(swapi.subscribe.bind(simpleRequest),
      /Handler function was not provided/);
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
        },
      );
    });

    it('should subscribe to remote data', () => {
      const swapi = createNetworkInterface({ uri: SWAPI_URL });

      // this is a stub for the end user client api
      const simpleRequest = {
        query: gql`
        subscription {
          raisingCount(delay: 10)
        }
        `,
        variables: {},
        debugName: 'raisingCount Subscription',
      };

      return new Promise((resolve, reject) => {
        let currentCount = 0;
        const subId = swapi.subscribe(simpleRequest, (e: Error, v: { [key: string]: any }) => {
          if (e) {
            setImmediate(() => swapi.unsubscribe(subId));
            return reject(e);
          }

          if (v.errors && v.errors.length > 0) {
            setImmediate(() => swapi.unsubscribe(subId));
            return reject(v.errors[0]);
          }

          try {
            assert.equal(v.data.raisingCount, currentCount ++);
          } catch (err) {
            setImmediate(() => swapi.unsubscribe(subId));
            return reject(e);
          }

          if ( 3 === currentCount ) {
            setImmediate(() => swapi.unsubscribe(subId));
            return resolve(v);
          }
        });
      });
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

  describe('supports hybrid mode', () => {
    const swapi = createNetworkInterface({
      uri: SWAPI_HTTP_URL,
      subscriptionsURI: SWAPI_URL,
    });

    it('should fetch remote data', () => {
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
        },
      );
    });

    it('should subscribe to remote data', () => {
      // this is a stub for the end user client api
      const simpleRequest = {
        query: gql`
        subscription {
          raisingCount(delay: 10)
        }
        `,
        variables: {},
        debugName: 'raisingCount Subscription',
      };

      return new Promise((resolve, reject) => {
        let currentCount = 0;
        const subId = swapi.subscribe(simpleRequest, (e: Error, v: { [key: string]: any }) => {
          if (e) {
            setImmediate(() => swapi.unsubscribe(subId));
            return reject(e);
          }

          if (v.errors && v.errors.length > 0) {
            setImmediate(() => swapi.unsubscribe(subId));
            return reject(v.errors[0]);
          }

          try {
            assert.equal(v.data.raisingCount, currentCount ++);
          } catch (err) {
            setImmediate(() => swapi.unsubscribe(subId));
            return reject(e);
          }

          if ( 3 === currentCount ) {
            setImmediate(() => swapi.unsubscribe(subId));
            return resolve(v);
          }
        });
      });
    });
  });
});
