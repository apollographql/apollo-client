import gql from 'graphql-tag';
import { sha256 } from 'crypto-hash';
import { print } from 'graphql';
import { times } from 'lodash';
import fetch from 'jest-fetch-mock';

import { ApolloLink, execute } from '../../core';
import { Observable } from '../../../utilities';
import { createHttpLink } from '../../http/createHttpLink';

import { createPersistedQueryLink as createPersistedQuery, VERSION } from '../';
import { itAsync } from '../../../testing';

global.fetch = fetch;

const makeAliasFields = (fieldName: string, numAliases: number) =>
  times(numAliases, idx => `${fieldName}${idx}: ${fieldName}`).reduce(
    (aliasBody, currentAlias) => `${aliasBody}\n    ${currentAlias}`,
  );

const query = gql`
  query Test($id: ID!) {
    foo(id: $id) {
      bar
      ${makeAliasFields('title', 1000)}
    }
  }
`;

const variables = { id: 1 };
const queryString = print(query);
const data = {
  foo: { bar: true },
};
const response = JSON.stringify({ data });
const errors = [{ message: 'PersistedQueryNotFound' }];
const giveUpErrors = [{ message: 'PersistedQueryNotSupported' }];
const multipleErrors = [...errors, { message: 'not logged in' }];
const errorResponse = JSON.stringify({ errors });
const giveUpResponse = JSON.stringify({ errors: giveUpErrors });
const multiResponse = JSON.stringify({ errors: multipleErrors });

describe('happy path', () => {
  let hash: string;
  beforeEach(async () => {
    fetch.mockReset();
    hash = hash || await sha256(queryString);
  });

  itAsync('sends a sha256 hash of the query under extensions', (resolve, reject) => {
    fetch.mockResponseOnce(response);
    const link = createPersistedQuery({ sha256 }).concat(createHttpLink());
    execute(link, { query, variables }).subscribe(result => {
      expect(result.data).toEqual(data);
      const [uri, request] = fetch.mock.calls[0];
      expect(uri).toEqual('/graphql');
      expect(request!.body!).toBe(
        JSON.stringify({
          operationName: 'Test',
          variables,
          extensions: {
            persistedQuery: {
              version: VERSION,
              sha256Hash: hash,
            },
          },
        }),
      );
      resolve();
    }, reject);
  });

  itAsync('sends a version along with the request', (resolve, reject) => {
    fetch.mockResponseOnce(response);
    const link = createPersistedQuery({ sha256 }).concat(createHttpLink());

    execute(link, { query, variables }).subscribe(result => {
      expect(result.data).toEqual(data);
      const [uri, request] = fetch.mock.calls[0];
      expect(uri).toEqual('/graphql');
      const parsed = JSON.parse(request!.body!.toString());
      expect(parsed.extensions.persistedQuery.version).toBe(VERSION);
      resolve();
    }, reject);
  });

  itAsync('memoizes between requests', (resolve, reject) => {
    fetch.mockResponseOnce(response);
    fetch.mockResponseOnce(response);
    const link = createPersistedQuery({ sha256 }).concat(createHttpLink());

    let start = new Date();
    execute(link, { query, variables }).subscribe(result => {
      const firstRun = new Date().valueOf() - start.valueOf();
      expect(result.data).toEqual(data);
      // this one should go faster becuase of memoization
      let secondStart = new Date();
      execute(link, { query, variables }).subscribe(result2 => {
        const secondRun = new Date().valueOf() - secondStart.valueOf();
        expect(firstRun).toBeGreaterThan(secondRun);
        expect(result2.data).toEqual(data);
        resolve();
      }, reject);
    }, reject);
  });

  itAsync('supports loading the hash from other method', (resolve, reject) => {
    fetch.mockResponseOnce(response);
    const generateHash =
      (query: any) => Promise.resolve('foo');
    const link = createPersistedQuery({ generateHash }).concat(
      createHttpLink(),
    );

    execute(link, { query, variables }).subscribe(result => {
      expect(result.data).toEqual(data);
      const [uri, request] = fetch.mock.calls[0];
      expect(uri).toEqual('/graphql');
      const parsed = JSON.parse(request!.body!.toString());
      expect(parsed.extensions.persistedQuery.sha256Hash).toBe('foo');
      resolve();
    }, reject);
  });

  itAsync('errors if unable to convert to sha256', (resolve, reject) => {
    fetch.mockResponseOnce(response);
    const link = createPersistedQuery({ sha256 }).concat(createHttpLink());

    execute(link, { query: '1234', variables } as any).subscribe(reject as any, error => {
      expect(error.message).toMatch(/Invalid AST Node/);
      resolve();
    });
  });

  itAsync('unsubscribes correctly', (resolve, reject) => {
    const delay = new ApolloLink(() => {
      return new Observable(ob => {
        setTimeout(() => {
          ob.next({ data });
          ob.complete();
        }, 100);
      });
    });
    const link = createPersistedQuery({ sha256 }).concat(delay);

    const sub = execute(link, { query, variables }).subscribe(
      reject,
      reject,
      reject,
    );

    setTimeout(() => {
      sub.unsubscribe();
      resolve();
    }, 10);
  });

  itAsync('should error if `sha256` and `generateHash` options are both missing', (resolve, reject) => {
    const createPersistedQueryFn = createPersistedQuery as any;
    try {
      createPersistedQueryFn();
      reject('should have thrown an error');
    } catch (error) {
      expect(
        error.message.indexOf(
          'Missing/invalid "sha256" or "generateHash" function'
        )
      ).toBe(0);
      resolve();
    }
  });

  itAsync('should error if `sha256` or `generateHash` options are not functions', (resolve, reject) => {
    const createPersistedQueryFn = createPersistedQuery as any;
    [
      { sha256: 'ooops' },
      { generateHash: 'ooops' }
    ].forEach(options => {
      try {
        createPersistedQueryFn(options);
        reject('should have thrown an error');
      } catch (error) {
        expect(
          error.message.indexOf(
            'Missing/invalid "sha256" or "generateHash" function'
          )
        ).toBe(0);
        resolve();
      }
    });
  });

  itAsync('should work with a synchronous SHA-256 function', (resolve, reject) => {
    const crypto = require('crypto');
    const sha256Hash = crypto.createHmac('sha256', queryString).digest('hex');

    fetch.mockResponseOnce(response);
    const link = createPersistedQuery({
      sha256(data) {
        return crypto.createHmac('sha256', data).digest('hex');
      }
    }).concat(createHttpLink());

    execute(link, { query, variables }).subscribe(result => {
      expect(result.data).toEqual(data);
      const [uri, request] = fetch.mock.calls[0];
      expect(uri).toEqual('/graphql');
      expect(request!.body!).toBe(
        JSON.stringify({
          operationName: 'Test',
          variables,
          extensions: {
            persistedQuery: {
              version: VERSION,
              sha256Hash: sha256Hash,
            },
          },
        }),
      );
      resolve();
    }, reject);
  });
});

describe('failure path', () => {
  let hash: string;
  beforeEach(async () => {
    fetch.mockReset();
    hash = hash || await sha256(queryString);
  });

  itAsync('correctly identifies the error shape from the server', (resolve, reject) => {
    fetch.mockResponseOnce(errorResponse);
    fetch.mockResponseOnce(response);
    const link = createPersistedQuery({ sha256 }).concat(createHttpLink());
    execute(link, { query, variables }).subscribe(result => {
      expect(result.data).toEqual(data);
      const [, failure] = fetch.mock.calls[0];
      expect(JSON.parse(failure!.body!.toString()).query).not.toBeDefined();
      const [, success] = fetch.mock.calls[1];
      expect(JSON.parse(success!.body!.toString()).query).toBe(queryString);
      expect(
        JSON.parse(success!.body!.toString()).extensions.persistedQuery.sha256Hash,
      ).toBe(hash);
      resolve();
    }, reject);
  });

  itAsync('sends GET for the first response only with useGETForHashedQueries', (resolve, reject) => {
    fetch.mockResponseOnce(errorResponse);
    fetch.mockResponseOnce(response);
    const link = createPersistedQuery({ sha256, useGETForHashedQueries: true }).concat(
      createHttpLink(),
    );
    execute(link, { query, variables }).subscribe(result => {
      expect(result.data).toEqual(data);
      const [, failure] = fetch.mock.calls[0];
      expect(failure!.method).toBe('GET');
      expect(failure!.body).not.toBeDefined();
      const [, success] = fetch.mock.calls[1];
      expect(success!.method).toBe('POST');
      expect(JSON.parse(success!.body!.toString()).query).toBe(queryString);
      expect(
        JSON.parse(success!.body!.toString()).extensions.persistedQuery.sha256Hash,
      ).toBe(hash);
      resolve();
    }, reject);
  });

  itAsync('sends POST for both requests without useGETForHashedQueries', (resolve, reject) => {
    fetch.mockResponseOnce(errorResponse);
    fetch.mockResponseOnce(response);
    const link = createPersistedQuery({ sha256 }).concat(
      createHttpLink(),
    );
    execute(link, { query, variables }).subscribe(result => {
      expect(result.data).toEqual(data);
      const [, failure] = fetch.mock.calls[0];
      expect(failure!.method).toBe('POST');
      expect(JSON.parse(failure!.body!.toString())).toEqual({
        operationName: 'Test',
        variables,
        extensions: {
          persistedQuery: {
            version: VERSION,
            sha256Hash: hash,
          },
        },
      });
      const [, success] = fetch.mock.calls[1];
      expect(success!.method).toBe('POST');
      expect(JSON.parse(success!.body!.toString())).toEqual({
        operationName: 'Test',
        query: queryString,
        variables,
        extensions: {
          persistedQuery: {
            version: VERSION,
            sha256Hash: hash,
          },
        },
      });
      resolve();
    }, reject);
  });

  // https://github.com/apollographql/apollo-client/pull/7456
  itAsync('forces POST request when sending full query', (resolve, reject) => {
    fetch.mockResponseOnce(giveUpResponse);
    fetch.mockResponseOnce(response);
    const link = createPersistedQuery({
      sha256,
      disable({ operation }) {
        operation.setContext({
          fetchOptions: {
            method: 'GET',
          },
        });
        return true;
      },
    }).concat(
      createHttpLink(),
    );
    execute(link, { query, variables }).subscribe(result => {
      expect(result.data).toEqual(data);
      const [, failure] = fetch.mock.calls[0];
      expect(failure!.method).toBe('POST');
      expect(JSON.parse(failure!.body!.toString())).toEqual({
        operationName: 'Test',
        variables,
        extensions: {
          persistedQuery: {
            version: VERSION,
            sha256Hash: hash,
          },
        },
      });
      const [, success] = fetch.mock.calls[1];
      expect(success!.method).toBe('POST');
      expect(JSON.parse(success!.body!.toString())).toEqual({
        operationName: 'Test',
        query: queryString,
        variables,
      });
      resolve();
    }, reject);
  });

  itAsync('does not try again after receiving NotSupported error', (resolve, reject) => {
    fetch.mockResponseOnce(giveUpResponse);
    fetch.mockResponseOnce(response);

    // mock it again so we can verify it doesn't try anymore
    fetch.mockResponseOnce(response);
    const link = createPersistedQuery({ sha256 }).concat(createHttpLink());

    execute(link, { query, variables }).subscribe(result => {
      expect(result.data).toEqual(data);
      const [, failure] = fetch.mock.calls[0];
      expect(JSON.parse(failure!.body!.toString()).query).not.toBeDefined();
      const [, success] = fetch.mock.calls[1];
      expect(JSON.parse(success!.body!.toString()).query).toBe(queryString);
      expect(JSON.parse(success!.body!.toString()).extensions).toBeUndefined();
      execute(link, { query, variables }).subscribe(secondResult => {
        expect(secondResult.data).toEqual(data);

        const [, success] = fetch.mock.calls[2];
        expect(JSON.parse(success!.body!.toString()).query).toBe(queryString);
        expect(JSON.parse(success!.body!.toString()).extensions).toBeUndefined();
        resolve();
      }, reject);
    }, reject);
  });

  itAsync('works with multiple errors', (resolve, reject) => {
    fetch.mockResponseOnce(multiResponse);
    fetch.mockResponseOnce(response);
    const link = createPersistedQuery({ sha256 }).concat(createHttpLink());
    execute(link, { query, variables }).subscribe(result => {
      expect(result.data).toEqual(data);
      const [, failure] = fetch.mock.calls[0];
      expect(JSON.parse(failure!.body!.toString()).query).not.toBeDefined();
      const [, success] = fetch.mock.calls[1];
      expect(JSON.parse(success!.body!.toString()).query).toBe(queryString);
      expect(
        JSON.parse(success!.body!.toString()).extensions.persistedQuery.sha256Hash,
      ).toBe(hash);
      resolve();
    }, reject);
  });

  itAsync('handles a 500 network error and still retries', (resolve, reject) => {
    let failed = false;
    fetch.mockResponseOnce(response);

    // mock it again so we can verify it doesn't try anymore
    fetch.mockResponseOnce(response);

    const fetcher = (...args: any[]) => {
      if (!failed) {
        failed = true;
        return Promise.resolve({
          json: () => Promise.resolve('This will blow up'),
          text: () => Promise.resolve('THIS WILL BLOW UP'),
          status: 500,
        });
      }

      return fetch(...args);
    };
    const link = createPersistedQuery({ sha256 }).concat(
      createHttpLink({ fetch: fetcher } as any),
    );

    execute(link, { query, variables }).subscribe(result => {
      expect(result.data).toEqual(data);
      const [, success] = fetch.mock.calls[0];
      expect(JSON.parse(success!.body!.toString()).query).toBe(queryString);
      expect(JSON.parse(success!.body!.toString()).extensions).toBeUndefined();
      execute(link, { query, variables }).subscribe(secondResult => {
        expect(secondResult.data).toEqual(data);

        const [, success] = fetch.mock.calls[1];
        expect(JSON.parse(success!.body!.toString()).query).toBe(queryString);
        expect(JSON.parse(success!.body!.toString()).extensions).toBeUndefined();
        resolve();
      }, reject);
    }, reject);
  });

  itAsync('handles a 400 network error and still retries', (resolve, reject) => {
    let failed = false;
    fetch.mockResponseOnce(response);

    // mock it again so we can verify it doesn't try anymore
    fetch.mockResponseOnce(response);

    const fetcher = (...args: any[]) => {
      if (!failed) {
        failed = true;
        return Promise.resolve({
          json: () => Promise.resolve('This will blow up'),
          text: () => Promise.resolve('THIS WILL BLOW UP'),
          status: 400,
        });
      }

      return fetch(...args);
    };
    const link = createPersistedQuery({ sha256 }).concat(
      createHttpLink({ fetch: fetcher } as any),
    );

    execute(link, { query, variables }).subscribe(result => {
      expect(result.data).toEqual(data);
      const [, success] = fetch.mock.calls[0];
      expect(JSON.parse(success!.body!.toString()).query).toBe(queryString);
      expect(JSON.parse(success!.body!.toString()).extensions).toBeUndefined();
      execute(link, { query, variables }).subscribe(secondResult => {
        expect(secondResult.data).toEqual(data);

        const [, success] = fetch.mock.calls[1];
        expect(JSON.parse(success!.body!.toString()).query).toBe(queryString);
        expect(JSON.parse(success!.body!.toString()).extensions).toBeUndefined();
        resolve();
      }, reject);
    }, reject);
  });

  itAsync('only retries a 400 network error once', (resolve, reject) => {
    let fetchCalls = 0;
    const fetcher = () => {
      fetchCalls++;
      return Promise.resolve({
        json: () => Promise.resolve('This will blow up'),
        text: () => Promise.resolve('THIS WILL BLOW UP'),
        status: 400,
      });
    };
    const link = createPersistedQuery({ sha256 }).concat(
      createHttpLink({ fetch: fetcher } as any),
    );

    execute(link, { query, variables }).subscribe(
      result => reject,
      error => {
        expect(fetchCalls).toBe(2);
        resolve();
      },
    );
  });

  itAsync('handles 400 response network error and graphql error without disabling persistedQuery support', (resolve, reject) => {
    let failed = false;
    fetch.mockResponseOnce(response);

    const fetcher = (...args: any[]) => {
      if (!failed) {
        failed = true;
        return Promise.resolve({
          json: () => Promise.resolve(errorResponse),
          text: () => Promise.resolve(errorResponse),
          status: 400,
        });
      }
      return fetch(...args);
    };

    const link = createPersistedQuery({ sha256 }).concat(
      createHttpLink({ fetch: fetcher } as any),
    );

    execute(link, { query, variables }).subscribe(result => {
      expect(result.data).toEqual(data);
      const [, success] = fetch.mock.calls[0];
      expect(JSON.parse(success!.body!.toString()).query).toBe(queryString);
      expect(JSON.parse(success!.body!.toString()).extensions).not.toBeUndefined();
      resolve();
    }, reject);
  });
});
