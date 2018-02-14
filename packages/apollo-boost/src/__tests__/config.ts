import ApolloClient, { gql } from '../';

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
        expect(data).toEqual({ foo: 'woo' });
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
        expect(data).toEqual({ foo: 'woo' });
        expect(requestCalled).toEqual(true);
      });
  });

  it('allows you to pass in cacheRedirects', () => {
    const cacheRedirects = { Query: { foo: () => 'woo' } };

    const client = new ApolloClient({
      cacheRedirects,
    });

    expect(client.cache.config.cacheRedirects).toEqual(cacheRedirects);
  });
});
