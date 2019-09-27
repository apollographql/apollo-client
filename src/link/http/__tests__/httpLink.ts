import gql from 'graphql-tag';
import fetchMock from 'fetch-mock';

import { execute } from '../../core';
import { sharedHttpTest } from './sharedHttpTests';
import { HttpLink, createHttpLink } from '../httpLink';

const sampleQuery = gql`
  query SampleQuery {
    stub {
      id
    }
  }
`;

const sampleMutation = gql`
  mutation SampleMutation {
    stub {
      id
    }
  }
`;

const makeCallback = (done, body) => {
  return (...args) => {
    try {
      body(...args);
      done();
    } catch (error) {
      done.fail(error);
    }
  };
};

describe('HttpLink', () => {
  describe('HttpLink-specific tests', () => {
    it('does not need any constructor arguments', () => {
      expect(() => new HttpLink()).not.toThrow();
    });

    const makePromise = res =>
      new Promise((resolve, reject) => setTimeout(() => resolve(res)));
    const data = { data: { hello: 'world' } };

    beforeEach(() => {
      fetchMock.restore();
      fetchMock.post('begin:http://data/', makePromise(data));
      fetchMock.get('begin:http://data/', makePromise(data));
    });

    afterEach(() => {
      fetchMock.restore();
    });

    it('constructor creates link that can call next and then complete', done => {
      const next = jest.fn();
      const link = new HttpLink({ uri: 'http://data/' });
      const observable = execute(link, {
        query: sampleQuery,
      });
      observable.subscribe({
        next,
        error: error => expect(false),
        complete: () => {
          expect(next).toHaveBeenCalledTimes(1);
          done();
        },
      });
    });

    it('supports using a GET request', done => {
      const variables = { params: 'stub' };
      const extensions = { myExtension: 'foo' };

      const link = createHttpLink({
        uri: 'http://data/',
        fetchOptions: { method: 'GET' },
        includeExtensions: true,
      });

      execute(link, { query: sampleQuery, variables, extensions }).subscribe({
        next: makeCallback(done, result => {
          const [uri, options] = fetchMock.lastCall();
          const { method, body } = options;
          expect(body).toBeUndefined();
          expect(method).toBe('GET');
          expect(uri).toBe(
            'http://data/?query=query%20SampleQuery%20%7B%0A%20%20stub%20%7B%0A%20%20%20%20id%0A%20%20%7D%0A%7D%0A&operationName=SampleQuery&variables=%7B%22params%22%3A%22stub%22%7D&extensions=%7B%22myExtension%22%3A%22foo%22%7D',
          );
        }),
        error: error => done.fail(error),
      });
    });

    it('supports using a GET request with search and fragment', done => {
      const variables = { params: 'stub' };

      const link = createHttpLink({
        uri: 'http://data/?foo=bar#frag',
        fetchOptions: { method: 'GET' },
      });

      execute(link, { query: sampleQuery, variables }).subscribe({
        next: makeCallback(done, result => {
          const [uri, options] = fetchMock.lastCall();
          const { method, body } = options;
          expect(body).toBeUndefined();
          expect(method).toBe('GET');
          expect(uri).toBe(
            'http://data/?foo=bar&query=query%20SampleQuery%20%7B%0A%20%20stub%20%7B%0A%20%20%20%20id%0A%20%20%7D%0A%7D%0A&operationName=SampleQuery&variables=%7B%22params%22%3A%22stub%22%7D#frag',
          );
        }),
        error: error => done.fail(error),
      });
    });

    it('supports using a GET request on the context', done => {
      const variables = { params: 'stub' };
      const link = createHttpLink({
        uri: 'http://data/',
      });

      execute(link, {
        query: sampleQuery,
        variables,
        context: {
          fetchOptions: { method: 'GET' },
        },
      }).subscribe(
        makeCallback(done, result => {
          const [uri, options] = fetchMock.lastCall();
          const { method, body } = options;
          expect(body).toBeUndefined();
          expect(method).toBe('GET');
          expect(uri).toBe(
            'http://data/?query=query%20SampleQuery%20%7B%0A%20%20stub%20%7B%0A%20%20%20%20id%0A%20%20%7D%0A%7D%0A&operationName=SampleQuery&variables=%7B%22params%22%3A%22stub%22%7D',
          );
        }),
      );
    });

    it('uses GET with useGETForQueries', done => {
      const variables = { params: 'stub' };
      const link = createHttpLink({
        uri: 'http://data/',
        useGETForQueries: true,
      });

      execute(link, {
        query: sampleQuery,
        variables,
      }).subscribe(
        makeCallback(done, result => {
          const [uri, options] = fetchMock.lastCall();
          const { method, body } = options;
          expect(body).toBeUndefined();
          expect(method).toBe('GET');
          expect(uri).toBe(
            'http://data/?query=query%20SampleQuery%20%7B%0A%20%20stub%20%7B%0A%20%20%20%20id%0A%20%20%7D%0A%7D%0A&operationName=SampleQuery&variables=%7B%22params%22%3A%22stub%22%7D',
          );
        }),
      );
    });

    it('uses POST for mutations with useGETForQueries', done => {
      const variables = { params: 'stub' };
      const link = createHttpLink({
        uri: 'http://data/',
        useGETForQueries: true,
      });

      execute(link, {
        query: sampleMutation,
        variables,
      }).subscribe(
        makeCallback(done, result => {
          const [uri, options] = fetchMock.lastCall();
          const { method, body } = options;
          expect(body).toBeDefined();
          expect(method).toBe('POST');
          expect(uri).toBe('http://data/');
        }),
      );
    });

    it('should add client awareness settings to request headers', done => {
      const variables = { params: 'stub' };
      const link = createHttpLink({
        uri: 'http://data/',
      });

      const clientAwareness = {
        name: 'Some Client Name',
        version: '1.0.1',
      };

      execute(link, {
        query: sampleQuery,
        variables,
        context: {
          clientAwareness,
        },
      }).subscribe(
        makeCallback(done, result => {
          const [uri, options] = fetchMock.lastCall();
          const { headers } = options;
          expect(headers['apollographql-client-name']).toBeDefined();
          expect(headers['apollographql-client-name']).toEqual(
            clientAwareness.name,
          );
          expect(headers['apollographql-client-version']).toBeDefined();
          expect(headers['apollographql-client-version']).toEqual(
            clientAwareness.version,
          );
        }),
      );
    });

    it('should not add empty client awareness settings to request headers', done => {
      const variables = { params: 'stub' };
      const link = createHttpLink({
        uri: 'http://data/',
      });

      const hasOwn = Object.prototype.hasOwnProperty;
      const clientAwareness = {};
      execute(link, {
        query: sampleQuery,
        variables,
        context: {
          clientAwareness,
        },
      }).subscribe(
        makeCallback(done, result => {
          const [uri, options] = fetchMock.lastCall();
          const { headers } = options;
          expect(hasOwn.call(headers, 'apollographql-client-name')).toBe(false);
          expect(hasOwn.call(headers, 'apollographql-client-version')).toBe(
            false,
          );
        }),
      );
    });
  });

  it("throws for GET if the variables can't be stringified", done => {
    const link = createHttpLink({
      uri: 'http://data/',
      useGETForQueries: true,
    });

    let b;
    const a = { b };
    b = { a };
    a.b = b;
    const variables = {
      a,
      b,
    };
    execute(link, { query: sampleQuery, variables }).subscribe(
      result => {
        done.fail('next should have been thrown from the link');
      },
      makeCallback(done, e => {
        expect(e.message).toMatch(/Variables map is not serializable/);
        expect(e.parseError.message).toMatch(
          /Converting circular structure to JSON/,
        );
      }),
    );
  });

  it("throws for GET if the extensions can't be stringified", done => {
    const link = createHttpLink({
      uri: 'http://data/',
      useGETForQueries: true,
      includeExtensions: true,
    });

    let b;
    const a = { b };
    b = { a };
    a.b = b;
    const extensions = {
      a,
      b,
    };
    execute(link, { query: sampleQuery, extensions }).subscribe(
      result => {
        done.fail('next should have been thrown from the link');
      },
      makeCallback(done, e => {
        expect(e.message).toMatch(/Extensions map is not serializable/);
        expect(e.parseError.message).toMatch(
          /Converting circular structure to JSON/,
        );
      }),
    );
  });

  sharedHttpTest('HttpLink', createHttpLink);
});
