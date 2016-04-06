import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { cloneDeep } from 'lodash';

// make it easy to assert with promises
chai.use(chaiAsPromised);

const { assert } = chai;

import {
  AuthTokenHeaderMiddleware,
  MiddlewareRequest,
} from '../src/middleware';

describe('middleware', () => {
  describe('AuthTokenHeaderMiddleware', () => {
    it('should implement applyMiddleware', () => {
      const authMiddleware = new AuthTokenHeaderMiddleware();
      assert.equal(typeof authMiddleware.applyMiddleware, 'function');
    });

    it('should create headers and add if none existing', () => {
      const authMiddleware = new AuthTokenHeaderMiddleware();
      authMiddleware.setToken('token');

      // this is a stub for the end user client api
      const middlewareRequest = {
        request: {
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
        },
        options: {},
      } as MiddlewareRequest;

      const next = () => {
        return;
      };

      const outcome = new Headers();
      outcome['Authorization'] = 'token';

      authMiddleware.applyMiddleware(middlewareRequest, next);

      assert.deepEqual(
        middlewareRequest.options.headers,
        outcome
      );

    });

    it('should add the token to existing headers', () => {
      const authMiddleware = new AuthTokenHeaderMiddleware();
      authMiddleware.setToken('token');

      const existingHeaders = new Headers();
      existingHeaders['Test'] = 'test';

      // this is a stub for the end user client api
      const middlewareRequest = {
        request: {
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
        },
        options: {
          headers: existingHeaders,
        },
      } as MiddlewareRequest;

      const next = () => {
        return;
      };

      const outcome = cloneDeep(existingHeaders);
      outcome['Authorization'] = 'token';

      authMiddleware.applyMiddleware(middlewareRequest, next);
      assert.deepEqual(
        middlewareRequest.options.headers,
        outcome
      );

    });

    it('should not add the token if no token and no headers', () => {
      const authMiddleware = new AuthTokenHeaderMiddleware();

      // this is a stub for the end user client api
      const middlewareRequest = {
        request: {
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
        },
        options: {},
      } as MiddlewareRequest;

      const next = () => {
        return;
      };

      authMiddleware.applyMiddleware(middlewareRequest, next);
      assert.isUndefined(middlewareRequest.options.headers);
    });

    it('should not add the token if no token and existing headers', () => {
      const authMiddleware = new AuthTokenHeaderMiddleware();

      const existingHeaders = new Headers();
      existingHeaders['Test'] = 'test';

      // this is a stub for the end user client api
      const middlewareRequest = {
        request: {
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
        },
        options: {
          headers: existingHeaders,
        },
      } as MiddlewareRequest;

      const next = () => {
        return;
      };

      authMiddleware.applyMiddleware(middlewareRequest, next);
      assert.deepEqual(
        middlewareRequest.options.headers,
        existingHeaders
      );
    });

    it('should allow setting a custom header', () => {
      const authMiddleware = new AuthTokenHeaderMiddleware();
      assert.equal(typeof authMiddleware.setHeader, 'function');
    });

    it('should use the custom header instead of default', () => {
      const authMiddleware = new AuthTokenHeaderMiddleware();
      authMiddleware.setHeader('Auth-Token');
      authMiddleware.setToken('token-token');

      // this is a stub for the end user client api
      const middlewareRequest = {
        request: {
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
        },
        options: {},
      } as MiddlewareRequest;

      const next = () => {
        return;
      };

      const outcome = new Headers();
      outcome['Auth-Token'] = 'token-token';

      authMiddleware.applyMiddleware(middlewareRequest, next);

      assert.deepEqual(
        middlewareRequest.options.headers,
        outcome
      );

    });

  });
});
