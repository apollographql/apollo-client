import ApolloClient, { gql, InMemoryCache } from '../';
import { stripSymbols } from 'apollo-utilities';
import fetchMock from 'fetch-mock';

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

  const remoteQuery = gql`
    {
      foo
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
    const customFetcher = jest.fn(() =>
      Promise.resolve({
        text: () => Promise.resolve('{"data": {"foo": "woo" }}'),
      }),
    );

    let requestCalled;

    const client = new ApolloClient({
      request: () => {
        requestCalled = true;
      },
      fetch: customFetcher,
    });

    return client
      .query({ query: remoteQuery, fetchPolicy: 'network-only' })
      .then(({ data }) => {
        expect(stripSymbols(data)).toEqual({ foo: 'woo' });
        expect(requestCalled).toEqual(true);
      });
  });

  it('allows you to pass in an async request handler', () => {
    const customFetcher = jest.fn(() =>
      Promise.resolve({
        text: () => Promise.resolve('{"data": {"foo": "woo" }}'),
      }),
    );

    let requestCalled;

    const client = new ApolloClient({
      request: () => {
        Promise.resolve().then(() => {
          requestCalled = true;
        });
      },
      fetch: customFetcher,
    });

    return client
      .query({ query: remoteQuery, fetchPolicy: 'network-only' })
      .then(({ data }) => {
        expect(stripSymbols(data)).toEqual({ foo: 'woo' });
        expect(requestCalled).toEqual(true);
      });
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

  it('allows you to pass in name and version', () => {
    const name = 'client-name';
    const version = 'client-version';

    const client = new ApolloClient({
      name,
      version,
    });

    expect(client.clientAwareness.name).toEqual(name);
    expect(client.clientAwareness.version).toEqual(version);
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
      client.query({ query: remoteQuery, errorPolicy: 'ignore' });
      const [uri, options] = fetchMock.lastCall();
      expect(options.credentials).toEqual('same-origin');
    });

    it('should set `credentials` to `config.credentials` if supplied', () => {
      const client = new ApolloClient({
        credentials: 'some-new-value',
      });
      client.query({ query: remoteQuery, errorPolicy: 'ignore' });
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
        client.query({ query: remoteQuery, errorPolicy: 'ignore' });
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
      client.query({ query: remoteQuery, errorPolicy: 'ignore' });
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
