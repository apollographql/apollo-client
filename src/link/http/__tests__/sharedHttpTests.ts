import Observable from 'zen-observable';
import { print } from 'graphql';
import gql from 'graphql-tag';
import fetchMock from 'fetch-mock';

import { ApolloLink, execute } from '../../core';

const sampleQuery = gql`
  query SampleQuery {
    stub {
      id
    }
  }
`;

const sampleMutation = gql`
  mutation SampleMutation {
    stub(param: "value") {
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

export const sharedHttpTest = (
  linkName,
  createLink,
  batchedRequests = false,
) => {
  const convertBatchedBody = body => {
    const parsed = JSON.parse(body);
    if (batchedRequests) {
      expect(Array.isArray(parsed));
      expect(parsed.length).toBe(1);
      return parsed.pop();
    }
    return parsed;
  };

  describe(`SharedHttpTest : ${linkName}`, () => {
    const data = { data: { hello: 'world' } };
    const data2 = { data: { hello: 'everyone' } };
    const mockError = { throws: new TypeError('mock me') };

    const makePromise = res =>
      new Promise((resolve, reject) => setTimeout(() => resolve(res)));

    let subscriber;

    beforeEach(() => {
      fetchMock.restore();
      fetchMock.post('begin:/data2', makePromise(data2));
      fetchMock.post('begin:/data', makePromise(data));
      fetchMock.post('begin:/error', mockError);
      fetchMock.post('begin:/apollo', makePromise(data));

      fetchMock.get('begin:/data', makePromise(data));
      fetchMock.get('begin:/data2', makePromise(data2));

      const next = jest.fn();
      const error = jest.fn();
      const complete = jest.fn();

      subscriber = {
        next,
        error,
        complete,
      };
    });

    afterEach(() => {
      fetchMock.restore();
    });

    it('raises warning if called with concat', () => {
      const link = createLink();
      const _warn = console.warn;
      console.warn = warning => expect(warning['message']).toBeDefined();
      expect(link.concat((operation, forward) => forward(operation))).toEqual(
        link,
      );
      console.warn = _warn;
    });

    it('does not need any constructor arguments', () => {
      expect(() => createLink()).not.toThrow();
    });

    it('calls next and then complete', done => {
      const next = jest.fn();
      const link = createLink({ uri: 'data' });
      const observable = execute(link, {
        query: sampleQuery,
      });
      observable.subscribe({
        next,
        error: error => done.fail(error),
        complete: makeCallback(done, () => {
          expect(next).toHaveBeenCalledTimes(1);
        }),
      });
    });

    it('calls error when fetch fails', done => {
      const link = createLink({ uri: 'error' });
      const observable = execute(link, {
        query: sampleQuery,
      });
      observable.subscribe(
        result => done.fail('next should not have been called'),
        makeCallback(done, error => {
          expect(error).toEqual(mockError.throws);
        }),
        () => done.fail('complete should not have been called'),
      );
    });

    it('calls error when fetch fails', done => {
      const link = createLink({ uri: 'error' });
      const observable = execute(link, {
        query: sampleMutation,
      });
      observable.subscribe(
        result => done.fail('next should not have been called'),
        makeCallback(done, error => {
          expect(error).toEqual(mockError.throws);
        }),
        () => done.fail('complete should not have been called'),
      );
    });

    it('unsubscribes without calling subscriber', done => {
      const link = createLink({ uri: 'data' });
      const observable = execute(link, {
        query: sampleQuery,
      });
      const subscription = observable.subscribe(
        result => done.fail('next should not have been called'),
        error => done.fail(error),
        () => done.fail('complete should not have been called'),
      );
      subscription.unsubscribe();
      expect(subscription.closed).toBe(true);
      setTimeout(done, 50);
    });

    const verifyRequest = (
      link: ApolloLink,
      after: () => void,
      includeExtensions: boolean,
      done: any,
    ) => {
      const next = jest.fn();
      const context = { info: 'stub' };
      const variables = { params: 'stub' };

      const observable = execute(link, {
        query: sampleMutation,
        context,
        variables,
      });
      observable.subscribe({
        next,
        error: error => done.fail(error),
        complete: () => {
          try {
            let body = convertBatchedBody(fetchMock.lastCall()[1].body);
            expect(body.query).toBe(print(sampleMutation));
            expect(body.variables).toEqual(variables);
            expect(body.context).not.toBeDefined();
            if (includeExtensions) {
              expect(body.extensions).toBeDefined();
            } else {
              expect(body.extensions).not.toBeDefined();
            }
            expect(next).toHaveBeenCalledTimes(1);

            after();
          } catch (e) {
            done.fail(e);
          }
        },
      });
    };

    it('passes all arguments to multiple fetch body including extensions', done => {
      debugger;
      const link = createLink({ uri: 'data', includeExtensions: true });
      verifyRequest(
        link,
        () => verifyRequest(link, done, true, done),
        true,
        done,
      );
    });

    it('passes all arguments to multiple fetch body excluding extensions', done => {
      const link = createLink({ uri: 'data' });
      verifyRequest(
        link,
        () => verifyRequest(link, done, false, done),
        false,
        done,
      );
    });

    it('calls multiple subscribers', done => {
      const link = createLink({ uri: 'data' });
      const context = { info: 'stub' };
      const variables = { params: 'stub' };

      const observable = execute(link, {
        query: sampleMutation,
        context,
        variables,
      });
      observable.subscribe(subscriber);
      observable.subscribe(subscriber);

      setTimeout(() => {
        expect(subscriber.next).toHaveBeenCalledTimes(2);
        expect(subscriber.complete).toHaveBeenCalledTimes(2);
        expect(subscriber.error).not.toHaveBeenCalled();
        done();
      }, 50);
    });

    it('calls remaining subscribers after unsubscribe', done => {
      const link = createLink({ uri: 'data' });
      const context = { info: 'stub' };
      const variables = { params: 'stub' };

      const observable = execute(link, {
        query: sampleMutation,
        context,
        variables,
      });

      observable.subscribe(subscriber);

      setTimeout(() => {
        const subscription = observable.subscribe(subscriber);
        subscription.unsubscribe();
      }, 10);

      setTimeout(
        makeCallback(done, () => {
          expect(subscriber.next).toHaveBeenCalledTimes(1);
          expect(subscriber.complete).toHaveBeenCalledTimes(1);
          expect(subscriber.error).not.toHaveBeenCalled();
          done();
        }),
        50,
      );
    });

    it('allows for dynamic endpoint setting', done => {
      const variables = { params: 'stub' };
      const link = createLink({ uri: 'data' });

      execute(link, {
        query: sampleQuery,
        variables,
        context: { uri: 'data2' },
      }).subscribe(result => {
        expect(result).toEqual(data2);
        done();
      });
    });

    it('adds headers to the request from the context', done => {
      const variables = { params: 'stub' };
      const middleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          headers: { authorization: '1234' },
        });
        return forward(operation).map(result => {
          const { headers } = operation.getContext();
          try {
            expect(headers).toBeDefined();
          } catch (e) {
            done.fail(e);
          }
          return result;
        });
      });
      const link = middleware.concat(createLink({ uri: 'data' }));

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(done, result => {
          const headers = fetchMock.lastCall()[1].headers;
          expect(headers.authorization).toBe('1234');
          expect(headers['content-type']).toBe('application/json');
          expect(headers.accept).toBe('*/*');
        }),
      );
    });

    it('adds headers to the request from the setup', done => {
      const variables = { params: 'stub' };
      const link = createLink({
        uri: 'data',
        headers: { authorization: '1234' },
      });

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(done, result => {
          const headers = fetchMock.lastCall()[1].headers;
          expect(headers.authorization).toBe('1234');
          expect(headers['content-type']).toBe('application/json');
          expect(headers.accept).toBe('*/*');
        }),
      );
    });

    it('prioritizes context headers over setup headers', done => {
      const variables = { params: 'stub' };
      const middleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          headers: { authorization: '1234' },
        });
        return forward(operation);
      });
      const link = middleware.concat(
        createLink({ uri: 'data', headers: { authorization: 'no user' } }),
      );

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(done, result => {
          const headers = fetchMock.lastCall()[1].headers;
          expect(headers.authorization).toBe('1234');
          expect(headers['content-type']).toBe('application/json');
          expect(headers.accept).toBe('*/*');
        }),
      );
    });

    it('adds headers to the request from the context on an operation', done => {
      const variables = { params: 'stub' };
      const link = createLink({ uri: 'data' });

      const context = {
        headers: { authorization: '1234' },
      };
      execute(link, {
        query: sampleQuery,
        variables,
        context,
      }).subscribe(
        makeCallback(done, result => {
          const headers = fetchMock.lastCall()[1].headers;
          expect(headers.authorization).toBe('1234');
          expect(headers['content-type']).toBe('application/json');
          expect(headers.accept).toBe('*/*');
        }),
      );
    });

    it('adds creds to the request from the context', done => {
      const variables = { params: 'stub' };
      const middleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          credentials: 'same-team-yo',
        });
        return forward(operation);
      });
      const link = middleware.concat(createLink({ uri: 'data' }));

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(done, result => {
          const creds = fetchMock.lastCall()[1].credentials;
          expect(creds).toBe('same-team-yo');
        }),
      );
    });

    it('adds creds to the request from the setup', done => {
      const variables = { params: 'stub' };
      const link = createLink({ uri: 'data', credentials: 'same-team-yo' });

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(done, result => {
          const creds = fetchMock.lastCall()[1].credentials;
          expect(creds).toBe('same-team-yo');
        }),
      );
    });

    it('prioritizes creds from the context over the setup', done => {
      const variables = { params: 'stub' };
      const middleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          credentials: 'same-team-yo',
        });
        return forward(operation);
      });
      const link = middleware.concat(
        createLink({ uri: 'data', credentials: 'error' }),
      );

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(done, result => {
          const creds = fetchMock.lastCall()[1].credentials;
          expect(creds).toBe('same-team-yo');
        }),
      );
    });

    it('adds uri to the request from the context', done => {
      const variables = { params: 'stub' };
      const middleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          uri: 'data',
        });
        return forward(operation);
      });
      const link = middleware.concat(createLink());

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(done, result => {
          const uri = fetchMock.lastUrl();
          expect(uri).toBe('/data');
        }),
      );
    });

    it('adds uri to the request from the setup', done => {
      const variables = { params: 'stub' };
      const link = createLink({ uri: 'data' });

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(done, result => {
          const uri = fetchMock.lastUrl();
          expect(uri).toBe('/data');
        }),
      );
    });

    it('prioritizes context uri over setup uri', done => {
      const variables = { params: 'stub' };
      const middleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          uri: 'apollo',
        });
        return forward(operation);
      });
      const link = middleware.concat(
        createLink({ uri: 'data', credentials: 'error' }),
      );

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(done, result => {
          const uri = fetchMock.lastUrl();

          expect(uri).toBe('/apollo');
        }),
      );
    });

    it('allows uri to be a function', done => {
      const variables = { params: 'stub' };
      const customFetch = (uri, options) => {
        const { operationName } = convertBatchedBody(options.body);
        try {
          expect(operationName).toBe('SampleQuery');
        } catch (e) {
          done.fail(e);
        }
        return fetch('dataFunc', options);
      };

      const link = createLink({ fetch: customFetch });

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(done, result => {
          const uri = fetchMock.lastUrl();
          expect(fetchMock.lastUrl()).toBe('/dataFunc');
        }),
      );
    });

    it('adds fetchOptions to the request from the setup', done => {
      const variables = { params: 'stub' };
      const link = createLink({
        uri: 'data',
        fetchOptions: { someOption: 'foo', mode: 'no-cors' },
      });

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(done, result => {
          const { someOption, mode, headers } = fetchMock.lastCall()[1];
          expect(someOption).toBe('foo');
          expect(mode).toBe('no-cors');
          expect(headers['content-type']).toBe('application/json');
        }),
      );
    });

    it('adds fetchOptions to the request from the context', done => {
      const variables = { params: 'stub' };
      const middleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          fetchOptions: {
            someOption: 'foo',
          },
        });
        return forward(operation);
      });
      const link = middleware.concat(createLink({ uri: 'data' }));

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(done, result => {
          const { someOption } = fetchMock.lastCall()[1];
          expect(someOption).toBe('foo');
          done();
        }),
      );
    });

    it('prioritizes context over setup', done => {
      const variables = { params: 'stub' };
      const middleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          fetchOptions: {
            someOption: 'foo',
          },
        });
        return forward(operation);
      });
      const link = middleware.concat(
        createLink({ uri: 'data', fetchOptions: { someOption: 'bar' } }),
      );

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(done, result => {
          const { someOption } = fetchMock.lastCall()[1];
          expect(someOption).toBe('foo');
        }),
      );
    });

    it('allows for not sending the query with the request', done => {
      const variables = { params: 'stub' };
      const middleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          http: {
            includeQuery: false,
            includeExtensions: true,
          },
        });
        operation.extensions.persistedQuery = { hash: '1234' };
        return forward(operation);
      });
      const link = middleware.concat(createLink({ uri: 'data' }));

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(done, result => {
          let body = convertBatchedBody(fetchMock.lastCall()[1].body);

          expect(body.query).not.toBeDefined();
          expect(body.extensions).toEqual({ persistedQuery: { hash: '1234' } });
          done();
        }),
      );
    });

    it('sets the raw response on context', done => {
      const middleware = new ApolloLink((operation, forward) => {
        return new Observable(ob => {
          const op = forward(operation);
          const sub = op.subscribe({
            next: ob.next.bind(ob),
            error: ob.error.bind(ob),
            complete: makeCallback(done, e => {
              expect(operation.getContext().response.headers.toBeDefined);
              ob.complete();
            }),
          });

          return () => {
            sub.unsubscribe();
          };
        });
      });

      const link = middleware.concat(createLink({ uri: 'data', fetch }));

      execute(link, { query: sampleQuery }).subscribe(
        result => {
          done();
        },
        () => {},
      );
    });
  });

  describe('dev warnings', () => {
    let oldFetch;
    beforeEach(() => {
      oldFetch = window.fetch;
      delete window.fetch;
    });

    afterEach(() => {
      window.fetch = oldFetch;
    });

    it('warns if fetch is undeclared', done => {
      try {
        const link = createLink({ uri: 'data' });
        done.fail("warning wasn't called");
      } catch (e) {
        makeCallback(done, () =>
          expect(e.message).toMatch(/fetch is not found globally/),
        )();
      }
    });

    it('warns if fetch is undefined', done => {
      window.fetch = undefined;
      try {
        const link = createLink({ uri: 'data' });
        done.fail("warning wasn't called");
      } catch (e) {
        makeCallback(done, () =>
          expect(e.message).toMatch(/fetch is not found globally/),
        )();
      }
    });

    it('does not warn if fetch is undeclared but a fetch is passed', () => {
      expect(() => {
        const link = createLink({ uri: 'data', fetch: () => {} });
      }).not.toThrow();
    });
  });

  describe('error handling', () => {
    let responseBody;
    const text = jest.fn(() => {
      const responseBodyText = '{}';
      responseBody = JSON.parse(responseBodyText);
      return Promise.resolve(responseBodyText);
    });
    const textWithData = jest.fn(() => {
      responseBody = {
        data: { stub: { id: 1 } },
        errors: [{ message: 'dangit' }],
      };

      return Promise.resolve(JSON.stringify(responseBody));
    });

    const textWithErrors = jest.fn(() => {
      responseBody = {
        errors: [{ message: 'dangit' }],
      };

      return Promise.resolve(JSON.stringify(responseBody));
    });
    const fetch = jest.fn((uri, options) => {
      return Promise.resolve({ text });
    });
    beforeEach(() => {
      fetch.mockReset();
    });
    it('makes it easy to do stuff on a 401', done => {
      const middleware = new ApolloLink((operation, forward) => {
        return new Observable(ob => {
          fetch.mockReturnValueOnce(Promise.resolve({ status: 401, text }));
          const op = forward(operation);
          const sub = op.subscribe({
            next: ob.next.bind(ob),
            error: makeCallback(done, e => {
              expect(e.message).toMatch(/Received status code 401/);
              expect(e.statusCode).toEqual(401);
              ob.error(e);
            }),
            complete: ob.complete.bind(ob),
          });

          return () => {
            sub.unsubscribe();
          };
        });
      });

      const link = middleware.concat(createLink({ uri: 'data', fetch }));

      execute(link, { query: sampleQuery }).subscribe(
        result => {
          done.fail('next should have been thrown from the network');
        },
        () => {},
      );
    });

    it('throws an error if response code is > 300', done => {
      fetch.mockReturnValueOnce(Promise.resolve({ status: 400, text }));
      const link = createLink({ uri: 'data', fetch });

      execute(link, { query: sampleQuery }).subscribe(
        result => {
          done.fail('next should have been thrown from the network');
        },
        makeCallback(done, e => {
          expect(e.message).toMatch(/Received status code 400/);
          expect(e.statusCode).toBe(400);
          expect(e.result).toEqual(responseBody);
        }),
      );
    });
    it('throws an error if response code is > 300 and returns data', done => {
      fetch.mockReturnValueOnce(
        Promise.resolve({ status: 400, text: textWithData }),
      );

      const link = createLink({ uri: 'data', fetch });

      let called = false;

      execute(link, { query: sampleQuery }).subscribe(
        result => {
          called = true;
          expect(result).toEqual(responseBody);
        },
        e => {
          expect(called).toBe(true);
          expect(e.message).toMatch(/Received status code 400/);
          expect(e.statusCode).toBe(400);
          expect(e.result).toEqual(responseBody);
          done();
        },
      );
    });
    it('throws an error if only errors are returned', done => {
      fetch.mockReturnValueOnce(
        Promise.resolve({ status: 400, text: textWithErrors }),
      );

      const link = createLink({ uri: 'data', fetch });

      let called = false;

      execute(link, { query: sampleQuery }).subscribe(
        result => {
          done.fail('should not have called result because we have no data');
        },
        e => {
          expect(e.message).toMatch(/Received status code 400/);
          expect(e.statusCode).toBe(400);
          expect(e.result).toEqual(responseBody);
          done();
        },
      );
    });
    it('throws an error if empty response from the server ', done => {
      fetch.mockReturnValueOnce(Promise.resolve({ text }));
      text.mockReturnValueOnce(Promise.resolve('{ "body": "boo" }'));
      const link = createLink({ uri: 'data', fetch });

      execute(link, { query: sampleQuery }).subscribe(
        result => {
          done.fail('next should have been thrown from the network');
        },
        makeCallback(done, e => {
          expect(e.message).toMatch(
            /Server response was missing for query 'SampleQuery'/,
          );
        }),
      );
    });
    it("throws if the body can't be stringified", done => {
      fetch.mockReturnValueOnce(Promise.resolve({ data: {}, text }));
      const link = createLink({ uri: 'data', fetch });

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
          expect(e.message).toMatch(/Payload is not serializable/);
          expect(e.parseError.message).toMatch(
            /Converting circular structure to JSON/,
          );
        }),
      );
    });
    it('supports being cancelled and does not throw', done => {
      let called;
      class AbortController {
        signal: {};
        abort = () => {
          called = true;
        };
      }

      global.AbortController = AbortController;

      fetch.mockReturnValueOnce(Promise.resolve({ text }));
      text.mockReturnValueOnce(
        Promise.resolve('{ "data": { "hello": "world" } }'),
      );

      const link = createLink({ uri: 'data', fetch });

      const sub = execute(link, { query: sampleQuery }).subscribe({
        next: result => {
          done.fail('result should not have been called');
        },
        error: e => {
          done.fail(e);
        },
        complete: () => {
          done.fail('complete should not have been called');
        },
      });
      sub.unsubscribe();

      setTimeout(
        makeCallback(done, () => {
          delete global.AbortController;
          expect(called).toBe(true);
          fetch.mockReset();
          text.mockReset();
        }),
        150,
      );
    });

    const body = '{';
    const unparsableJson = jest.fn(() => Promise.resolve(body));
    it('throws an error if response is unparsable', done => {
      fetch.mockReturnValueOnce(
        Promise.resolve({ status: 400, text: unparsableJson }),
      );
      const link = createLink({ uri: 'data', fetch });

      execute(link, { query: sampleQuery }).subscribe(
        result => {
          done.fail('next should have been thrown from the network');
        },
        makeCallback(done, e => {
          expect(e.message).toMatch(/JSON/);
          expect(e.statusCode).toBe(400);
          expect(e.response).toBeDefined();
          expect(e.bodyText).toBe(body);
        }),
      );
    });
  });
};
