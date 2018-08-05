import ApolloClient, { gql, InMemoryCache } from '../';
import { stripSymbols } from 'apollo-utilities';
import * as fetchMock from 'fetch-mock';

global.fetch = jest.fn(() =>
  Promise.resolve({ json: () => Promise.resolve({}) }),
);

const sleep = ms => new Promise(res => setTimeout(res, ms));

describe('config', () => {
  const query = gql`
    {
      foo @client
    }
  `;

  const resolvers = {
    Query: {
      foo: () => 'woo',
    },
  };

  it('warns about unsupported parameter', () => {
    jest.spyOn(global.console, 'warn');

    const client = new ApolloClient({
      link: [],
    });

    expect(global.console.warn.mock.calls).toMatchSnapshot();
  });

  it('allows you to pass in a custom fetcher', () => {
    const customFetcher = jest.fn(() =>
      Promise.resolve({
        text: () => Promise.resolve('{"data": {"foo": "bar" }}'),
      }),
    );

    const client = new ApolloClient({
      fetch: customFetcher,
    });

    client.query({ query }).then(({ data }) => {
      expect(customFetcher).toHaveBeenCalledTimes(1);
      expect(stripSymbols(data)).toEqual({ foo: 'bar' });
    });
  });

  it('allows you to pass in a request handler', () => {
    let requestCalled;

    const client = new ApolloClient({
      request: () => {
        requestCalled = true;
      },
      clientState: { resolvers },
    });

    return client
      .query({ query, fetchPolicy: 'network-only' })
      .then(({ data }) => {
        expect(stripSymbols(data)).toEqual({ foo: 'woo' });
        expect(requestCalled).toEqual(true);
      });
  });

  it('allows you to pass in an async request handler', () => {
    let requestCalled;

    const client = new ApolloClient({
      request: () => {
        Promise.resolve().then(() => {
          requestCalled = true;
        });
      },
      clientState: { resolvers },
    });

    return client
      .query({ query, fetchPolicy: 'network-only' })
      .then(({ data }) => {
        expect(stripSymbols(data)).toEqual({ foo: 'woo' });
        expect(requestCalled).toEqual(true);
      });
  });

  it('allows you to pass a fn to customizeLinks links', () => {
    let called;

    const customizeLinks = (errorLink, requestHandler, stateLink, httpLink) => {
      called = true;
      return [errorLink, requestHandler, stateLink, httpLink];
    };

    const client = new ApolloClient({
      customizeLinks,
    });

    expect(called).toEqual(true);
  });

  it('throws if passed cache and cacheRedirects', () => {
    const cache = new InMemoryCache();
    const cacheRedirects = { Query: { foo: () => 'woo' } };

    expect(_ => {
      const client = new ApolloClient({
        cache,
        cacheRedirects,
      });
    }).toThrow('Incompatible cache configuration');
  });

  it('allows you to pass in cache', () => {
    const cache = new InMemoryCache();

    const client = new ApolloClient({
      cache,
    });

    expect(client.cache).toBe(cache);
  });

  it('allows you to pass in cacheRedirects', () => {
    const cacheRedirects = { Query: { foo: () => 'woo' } };

    const client = new ApolloClient({
      cacheRedirects,
    });

    expect(client.cache.config.cacheRedirects).toEqual(cacheRedirects);
  });

  const makePromise = res =>
    new Promise((resolve, reject) => setTimeout(() => resolve(res)));
  const data = { data: { hello: 'world' } };

  describe('credentials', () => {
    beforeEach(() => {
      fetchMock.restore();
      fetchMock.post('/graphql', makePromise(data));
    });

    afterEach(() => {
      fetchMock.restore();
    });

    it('should set `credentials` to `same-origin` by default', () => {
      const client = new ApolloClient({});
      client.query({ query, errorPolicy: 'ignore' });
      const [uri, options] = fetchMock.lastCall();
      expect(options.credentials).toEqual('same-origin');
    });

    it('should set `credentials` to `config.credentials` if supplied', () => {
      const client = new ApolloClient({
        credentials: 'some-new-value',
      });
      client.query({ query, errorPolicy: 'ignore' });
      const [uri, options] = fetchMock.lastCall();
      expect(options.credentials).toEqual('some-new-value');
    });
  });

  describe('headers', () => {
    beforeEach(() => {
      fetchMock.restore();
      fetchMock.post('/graphql', makePromise(data));
    });

    afterEach(() => {
      fetchMock.restore();
    });

    it(
      'should leave existing `headers` in place if no new headers are ' +
        'provided',
      () => {
        const client = new ApolloClient({});
        client.query({ query, errorPolicy: 'ignore' });
        const [uri, options] = fetchMock.lastCall();
        expect(options.headers).toEqual({
          accept: '*/*',
          'content-type': 'application/json',
        });
      },
    );

    it('should add new `config.headers` to existing headers', () => {
      const client = new ApolloClient({
        headers: {
          'new-header1': 'value1',
          'new-header2': 'value2',
        },
      });
      client.query({ query, errorPolicy: 'ignore' });
      const [uri, options] = fetchMock.lastCall();
      expect(options.headers).toEqual({
        accept: '*/*',
        'content-type': 'application/json',
        'new-header1': 'value1',
        'new-header2': 'value2',
      });
    });
  });
});
