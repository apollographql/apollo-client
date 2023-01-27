import fetchMock from 'fetch-mock';
import gql from 'graphql-tag';
import { ASTNode, print, stripIgnoredCharacters } from 'graphql';

import { ApolloLink } from '../../core/ApolloLink';
import { execute } from '../../core/execute';
import { Observable } from '../../../utilities/observables/Observable';
import { BatchHttpLink } from '../batchHttpLink';
import { itAsync } from '../../../testing';

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

function makeCallback<TArgs extends any[]>(
  resolve: () => void,
  reject: (error: Error) => void,
  callback: (...args: TArgs) => any,
) {
  return function () {
    try {
      callback.apply(this, arguments);
      resolve();
    } catch (error) {
      reject(error);
    }
  } as typeof callback;
}

describe('BatchHttpLink', () => {
  beforeAll(() => {
    jest.resetModules();
  });

  const headers = { cookie: 'monster' };
  const data = { data: { hello: 'world' } };
  const data2 = { data: { hello: 'everyone' } };
  const roflData = { data: { haha: 'hehe' } };
  const lawlData = { data: { tehe: 'haaa' } };
  const makePromise = (res: any) =>
    new Promise((resolve, reject) =>
      setTimeout(() =>
        resolve({
          headers,
          body: res,
        }),
      ),
    );

  beforeEach(() => {
    fetchMock.restore();
    fetchMock.post('begin:/batch', makePromise([data, data2]));
    fetchMock.post('begin:/rofl', makePromise([roflData, roflData]));
    fetchMock.post('begin:/lawl', makePromise([lawlData, lawlData]));
  });

  it('does not need any constructor arguments', () => {
    expect(() => new BatchHttpLink()).not.toThrow();
  });

  itAsync('handles batched requests', (resolve, reject) => {
    const clientAwareness = {
      name: 'Some Client Name',
      version: '1.0.1',
    };

    const link = new BatchHttpLink({
      uri: '/batch',
      batchInterval: 0,
      batchMax: 2,
    });

    let nextCalls = 0;
    let completions = 0;
    const next = (expectedData: any) => (data: any) => {
      try {
        expect(data).toEqual(expectedData);
        nextCalls++;
      } catch (error) {
        reject(error);
      }
    };

    const complete = () => {
      try {
        const calls = fetchMock.calls('begin:/batch');
        expect(calls.length).toBe(1);
        expect(nextCalls).toBe(2);

        const options: any = fetchMock.lastOptions('begin:/batch');
        expect(options.credentials).toEqual('two');

        const { headers } = options;
        expect(headers['apollographql-client-name']).toBeDefined();
        expect(headers['apollographql-client-name']).toEqual(
          clientAwareness.name,
        );
        expect(headers['apollographql-client-version']).toBeDefined();
        expect(headers['apollographql-client-version']).toEqual(
          clientAwareness.version,
        );

        completions++;

        if (completions === 2) {
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    };

    const error = (error: any) => {
      reject(error);
    };

    execute(link, {
      query: sampleQuery,
      context: {
        credentials: 'two',
        clientAwareness,
      },
    }).subscribe(next(data), error, complete);

    execute(link, {
      query: sampleQuery,
      context: { credentials: 'two' },
    }).subscribe(next(data2), error, complete);
  });

  itAsync('errors on an incorrect number of results for a batch', (resolve, reject) => {
    const link = new BatchHttpLink({
      uri: '/batch',
      batchInterval: 0,
      batchMax: 3,
    });

    let errors = 0;
    const next = (data: any) => {
      reject('next should not have been called');
    };

    const complete = () => {
      reject('complete should not have been called');
    };

    const error = (error: any) => {
      errors++;

      if (errors === 3) {
        resolve();
      }
    };

    execute(link, { query: sampleQuery }).subscribe(next, error, complete);
    execute(link, { query: sampleQuery }).subscribe(next, error, complete);
    execute(link, { query: sampleQuery }).subscribe(next, error, complete);
  });

  describe('batchKey', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;

    itAsync('should batch queries with different options separately', (resolve, reject) => {
      let key = true;
      const batchKey = () => {
        key = !key;
        return '' + !key;
      };

      const link = ApolloLink.from([
        new BatchHttpLink({
          uri: operation => {
            return operation.variables.endpoint;
          },
          batchInterval: 1,
          //if batchKey does not work, then the batch size would be 3
          batchMax: 2,
          batchKey,
        }),
      ]);

      let count = 0;
      const next = (expected: any) => (received: any) => {
        try {
          expect(received).toEqual(expected);
        } catch (e) {
          reject(e);
        }
      };
      const complete = () => {
        count++;
        if (count === 4) {
          try {
            const lawlCalls = fetchMock.calls('begin:/lawl');
            expect(lawlCalls.length).toBe(1);
            const roflCalls = fetchMock.calls('begin:/rofl');
            expect(roflCalls.length).toBe(1);
            resolve();
          } catch (e) {
            reject(e);
          }
        }
      };

      [1, 2].forEach(x => {
        execute(link, {
          query,
          variables: { endpoint: '/rofl' },
        }).subscribe({
          next: next(roflData),
          error: reject,
          complete,
        });

        execute(link, {
          query,
          variables: { endpoint: '/lawl' },
        }).subscribe({
          next: next(lawlData),
          error: reject,
          complete,
        });
      });
    });
  });
});

const convertBatchedBody = (body: any) => {
  const parsed = JSON.parse(body);
  expect(Array.isArray(parsed));
  expect(parsed.length).toBe(1);
  return parsed.pop();
};

const createHttpLink = (httpArgs?: any) => {
  const args = {
    ...httpArgs,
    batchInterval: 0,
    batchMax: 1,
  };
  return new BatchHttpLink(args);
};

describe('SharedHttpTest', () => {
  const data = { data: { hello: 'world' } };
  const data2 = { data: { hello: 'everyone' } };
  const mockError = { throws: new TypeError('mock me') };

  const makePromise = (res: any) =>
    new Promise((resolve, reject) => setTimeout(() => resolve(res)));

  let subscriber: any;

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
    const link = createHttpLink();
    const _warn = console.warn;
    console.warn = (warning: any) => expect(warning['message']).toBeDefined();
    expect(link.concat((operation, forward) => forward(operation))).toEqual(
      link,
    );
    console.warn = _warn;
  });

  it('does not need any constructor arguments', () => {
    expect(() => createHttpLink()).not.toThrow();
  });

  itAsync('calls next and then complete', (resolve, reject) => {
    const next = jest.fn();
    const link = createHttpLink({ uri: '/data' });
    const observable = execute(link, {
      query: sampleQuery,
    });
    observable.subscribe({
      next,
      error: error => reject(error),
      complete: makeCallback(resolve, reject, () => {
        expect(next).toHaveBeenCalledTimes(1);
      }),
    });
  });

  itAsync('calls error when fetch fails', (resolve, reject) => {
    const link = createHttpLink({ uri: '/error' });
    const observable = execute(link, {
      query: sampleQuery,
    });
    observable.subscribe(
      result => reject('next should not have been called'),
      makeCallback(resolve, reject, (error: any) => {
        expect(error).toEqual(mockError.throws);
      }),
      () => reject('complete should not have been called'),
    );
  });

  itAsync('calls error when fetch fails', (resolve, reject) => {
    const link = createHttpLink({ uri: '/error' });
    const observable = execute(link, {
      query: sampleMutation,
    });
    observable.subscribe(
      result => reject('next should not have been called'),
      makeCallback(resolve, reject, (error: any) => {
        expect(error).toEqual(mockError.throws);
      }),
      () => reject('complete should not have been called'),
    );
  });

  itAsync('unsubscribes without calling subscriber', (resolve, reject) => {
    const link = createHttpLink({ uri: '/data' });
    const observable = execute(link, {
      query: sampleQuery,
    });
    const subscription = observable.subscribe(
      result => reject('next should not have been called'),
      error => reject(error),
      () => reject('complete should not have been called'),
    );
    subscription.unsubscribe();
    expect(subscription.closed).toBe(true);
    setTimeout(resolve, 50);
  });

  const verifyRequest = (
    link: ApolloLink,
    after: () => void,
    includeExtensions: boolean,
    reject: (e: Error) => void,
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
      error: error => reject(error),
      complete: () => {
        try {
          let body = convertBatchedBody(fetchMock.lastCall()![1]!.body);
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
          reject(e);
        }
      },
    });
  };

  itAsync('passes all arguments to multiple fetch body including extensions', (resolve, reject) => {
    const link = createHttpLink({ uri: '/data', includeExtensions: true });
    verifyRequest(
      link,
      () => verifyRequest(link, resolve, true, reject),
      true,
      reject,
    );
  });

  itAsync('passes all arguments to multiple fetch body excluding extensions', (resolve, reject) => {
    const link = createHttpLink({ uri: '/data' });
    verifyRequest(
      link,
      () => verifyRequest(link, resolve, false, reject),
      false,
      reject,
    );
  });

  itAsync('calls multiple subscribers', (resolve, reject) => {
    const link = createHttpLink({ uri: '/data' });
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
      resolve();
    }, 50);
  });

  itAsync('calls remaining subscribers after unsubscribe', (resolve, reject) => {
    const link = createHttpLink({ uri: '/data' });
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
      makeCallback(resolve, reject, () => {
        expect(subscriber.next).toHaveBeenCalledTimes(1);
        expect(subscriber.complete).toHaveBeenCalledTimes(1);
        expect(subscriber.error).not.toHaveBeenCalled();
        resolve();
      }),
      50,
    );
  });

  itAsync('allows for dynamic endpoint setting', (resolve, reject) => {
    const variables = { params: 'stub' };
    const link = createHttpLink({ uri: '/data' });

    execute(link, {
      query: sampleQuery,
      variables,
      context: { uri: '/data2' },
    }).subscribe(result => {
      expect(result).toEqual(data2);
      resolve();
    });
  });

  itAsync('adds headers to the request from the context', (resolve, reject) => {
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
          reject(e);
        }
        return result;
      });
    });
    const link = middleware.concat(createHttpLink({ uri: '/data' }));

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const headers: Record<string, string> = fetchMock.lastCall()![1]!.headers as Record<string, string>;
        expect(headers.authorization).toBe('1234');
        expect(headers['content-type']).toBe('application/json');
        expect(headers.accept).toBe('*/*');
      }),
    );
  });

  itAsync('adds headers to the request from the setup', (resolve, reject) => {
    const variables = { params: 'stub' };
    const link = createHttpLink({
      uri: '/data',
      headers: { authorization: '1234' },
    });

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const headers: Record<string, string> = fetchMock.lastCall()![1]!.headers as Record<string, string>;
        expect(headers.authorization).toBe('1234');
        expect(headers['content-type']).toBe('application/json');
        expect(headers.accept).toBe('*/*');
      }),
    );
  });

  itAsync('prioritizes context headers over setup headers', (resolve, reject) => {
    const variables = { params: 'stub' };
    const middleware = new ApolloLink((operation, forward) => {
      operation.setContext({
        headers: { authorization: '1234' },
      });
      return forward(operation);
    });
    const link = middleware.concat(
      createHttpLink({ uri: '/data', headers: { authorization: 'no user' } }),
    );

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const headers: Record<string, string> = fetchMock.lastCall()![1]!.headers as Record<string, string>;
        expect(headers.authorization).toBe('1234');
        expect(headers['content-type']).toBe('application/json');
        expect(headers.accept).toBe('*/*');
      }),
    );
  });

  itAsync('adds headers to the request from the context on an operation', (resolve, reject) => {
    const variables = { params: 'stub' };
    const link = createHttpLink({ uri: '/data' });

    const context = {
      headers: { authorization: '1234' },
    };
    execute(link, {
      query: sampleQuery,
      variables,
      context,
    }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const headers: Record<string, string> = fetchMock.lastCall()![1]!.headers as Record<string, string>;
        expect(headers.authorization).toBe('1234');
        expect(headers['content-type']).toBe('application/json');
        expect(headers.accept).toBe('*/*');
      }),
    );
  });

  itAsync('adds headers w/ preserved case to the request from the setup', (resolve, reject) => {
    const variables = { params: 'stub' };
    const link = createHttpLink({
      uri: '/data',
      headers: { 
        authorization: '1234',
        AUTHORIZATION: '1234',
        'CONTENT-TYPE': 'application/json',
      },
      preserveHeaderCase: true,
    });

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const headers: any = fetchMock.lastCall()![1]!.headers;
        expect(headers.AUTHORIZATION).toBe('1234');
        expect(headers['CONTENT-TYPE']).toBe('application/json');
        expect(headers.accept).toBe('*/*');
      }),
    );
  });

  itAsync('prioritizes context headers w/ preserved case over setup headers', (resolve, reject) => {
    const variables = { params: 'stub' };
    const middleware = new ApolloLink((operation, forward) => {
      operation.setContext({
        headers: { AUTHORIZATION: '1234' },
        http: { preserveHeaderCase: true },
      });
      return forward(operation);
    });
    const link = middleware.concat(
      createHttpLink({ uri: '/data', headers: { authorization: 'no user' }, preserveHeaderCase: false }),
    );

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const headers: any = fetchMock.lastCall()![1]!.headers;
        expect(headers.AUTHORIZATION).toBe('1234');
        expect(headers['content-type']).toBe('application/json');
        expect(headers.accept).toBe('*/*');
      }),
    );
  });

  itAsync('adds headers w/ preserved case to the request from the context on an operation', (resolve, reject) => {
    const variables = { params: 'stub' };
    const link = createHttpLink({ uri: '/data' });

    const context = {
      headers: { AUTHORIZATION: '1234' },
      http: { preserveHeaderCase: true },
    };
    execute(link, {
      query: sampleQuery,
      variables,
      context,
    }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const headers: any = fetchMock.lastCall()![1]!.headers;
        expect(headers.AUTHORIZATION).toBe('1234');
        expect(headers['content-type']).toBe('application/json');
        expect(headers.accept).toBe('*/*');
      }),
    );
  });

  itAsync('adds creds to the request from the context', (resolve, reject) => {
    const variables = { params: 'stub' };
    const middleware = new ApolloLink((operation, forward) => {
      operation.setContext({
        credentials: 'same-team-yo',
      });
      return forward(operation);
    });
    const link = middleware.concat(createHttpLink({ uri: '/data' }));

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const creds = fetchMock.lastCall()![1]!.credentials;
        expect(creds).toBe('same-team-yo');
      }),
    );
  });

  itAsync('adds creds to the request from the setup', (resolve, reject) => {
    const variables = { params: 'stub' };
    const link = createHttpLink({ uri: '/data', credentials: 'same-team-yo' });

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const creds = fetchMock.lastCall()![1]!.credentials;
        expect(creds).toBe('same-team-yo');
      }),
    );
  });

  itAsync('prioritizes creds from the context over the setup', (resolve, reject) => {
    const variables = { params: 'stub' };
    const middleware = new ApolloLink((operation, forward) => {
      operation.setContext({
        credentials: 'same-team-yo',
      });
      return forward(operation);
    });
    const link = middleware.concat(
      createHttpLink({ uri: '/data', credentials: 'error' }),
    );

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const creds = fetchMock.lastCall()![1]!.credentials;
        expect(creds).toBe('same-team-yo');
      }),
    );
  });

  itAsync('adds uri to the request from the context', (resolve, reject) => {
    const variables = { params: 'stub' };
    const middleware = new ApolloLink((operation, forward) => {
      operation.setContext({
        uri: '/data',
      });
      return forward(operation);
    });
    const link = middleware.concat(createHttpLink());

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const uri = fetchMock.lastUrl();
        expect(uri).toBe('/data');
      }),
    );
  });

  itAsync('adds uri to the request from the setup', (resolve, reject) => {
    const variables = { params: 'stub' };
    const link = createHttpLink({ uri: '/data' });

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const uri = fetchMock.lastUrl();
        expect(uri).toBe('/data');
      }),
    );
  });

  itAsync('prioritizes context uri over setup uri', (resolve, reject) => {
    const variables = { params: 'stub' };
    const middleware = new ApolloLink((operation, forward) => {
      operation.setContext({
        uri: '/apollo',
      });
      return forward(operation);
    });
    const link = middleware.concat(
      createHttpLink({ uri: '/data', credentials: 'error' }),
    );

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const uri = fetchMock.lastUrl();

        expect(uri).toBe('/apollo');
      }),
    );
  });

  itAsync('allows uri to be a function', (resolve, reject) => {
    const variables = { params: 'stub' };
    const customFetch = (_uri: any, options: any) => {
      const { operationName } = convertBatchedBody(options.body);
      try {
        expect(operationName).toBe('SampleQuery');
      } catch (e) {
        reject(e);
      }
      return fetch('/dataFunc', options);
    };

    const link = createHttpLink({ fetch: customFetch });

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        expect(fetchMock.lastUrl()).toBe('/dataFunc');
      }),
    );
  });

  itAsync('adds fetchOptions to the request from the setup', (resolve, reject) => {
    const variables = { params: 'stub' };
    const link = createHttpLink({
      uri: '/data',
      fetchOptions: { someOption: 'foo', mode: 'no-cors' },
    });

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const { someOption, mode, headers } = fetchMock.lastCall()![1]! as any;
        expect(someOption).toBe('foo');
        expect(mode).toBe('no-cors');
        expect(headers['content-type']).toBe('application/json');
      }),
    );
  });

  itAsync('adds fetchOptions to the request from the context', (resolve, reject) => {
    const variables = { params: 'stub' };
    const middleware = new ApolloLink((operation, forward) => {
      operation.setContext({
        fetchOptions: {
          someOption: 'foo',
        },
      });
      return forward(operation);
    });
    const link = middleware.concat(createHttpLink({ uri: '/data' }));

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const { someOption } = fetchMock.lastCall()![1]! as any;
        expect(someOption).toBe('foo');
        resolve();
      }),
    );
  });

  itAsync('uses the print option function when defined', (resolve, reject) => {
    const customPrinter = jest.fn(
      (ast: ASTNode, originalPrint: typeof print) => {
        return stripIgnoredCharacters(originalPrint(ast));
      }
    );

    const httpLink = createHttpLink({ uri: 'data', print: customPrinter });

    execute(httpLink, {
      query: sampleQuery,
    }).subscribe(
      makeCallback(resolve, reject, () => {
        expect(customPrinter).toHaveBeenCalledTimes(1);
      }),
    );
  });

  itAsync('prioritizes context over setup', (resolve, reject) => {
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
      createHttpLink({ uri: '/data', fetchOptions: { someOption: 'bar' } }),
    );

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const { someOption } = fetchMock.lastCall()![1]! as any;
        expect(someOption).toBe('foo');
      }),
    );
  });

  itAsync('allows for not sending the query with the request', (resolve, reject) => {
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
    const link = middleware.concat(createHttpLink({ uri: '/data' }));

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        let body = convertBatchedBody(fetchMock.lastCall()![1]!.body);

        expect(body.query).not.toBeDefined();
        expect(body.extensions).toEqual({ persistedQuery: { hash: '1234' } });
        resolve();
      }),
    );
  });

  itAsync('sets the raw response on context', (resolve, reject) => {
    const middleware = new ApolloLink((operation, forward) => {
      return new Observable(ob => {
        const op = forward(operation);
        const sub = op.subscribe({
          next: ob.next.bind(ob),
          error: ob.error.bind(ob),
          complete: makeCallback(resolve, reject, () => {
            expect(operation.getContext().response.headers.toBeDefined);
            ob.complete();
          }),
        });

        return () => {
          sub.unsubscribe();
        };
      });
    });

    const link = middleware.concat(createHttpLink({ uri: '/data', fetch }));

    execute(link, { query: sampleQuery }).subscribe(
      result => {
        resolve();
      },
      () => {},
    );
  });
});
