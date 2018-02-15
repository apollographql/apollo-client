import ApolloClient, { gql } from '../';
import { withClientState } from 'apollo-link-state';
import { InMemoryCache } from 'apollo-cache-inmemory';

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

  it('writes defaults to the cache correctly', () => {
    const client = new ApolloClient({
      clientState: {
        defaults: {
          likedPhotos: [],
        },
      },
    });

    expect(client.cache.extract()).toMatchSnapshot();

    const cache = new InMemoryCache();
    const otherClient = new ApolloClient({
      cache,
      link: withClientState({
        cache,
        defaults: {
          likedPhotos: [],
        },
      }),
    });

    expect(cache.extract()).toMatchSnapshot();

    cache.writeData({ data: { woo: [] } });
    expect(cache.extract()).toMatchSnapshot();

    const query = gql`
      {
        foo
      }
    `;
    cache.writeQuery({ query, data: { foo: [] } });
    expect(cache.extract()).toMatchSnapshot();

    const fragment = gql`
      fragment boo on Boo {
        boo
      }
    `;
    cache.writeFragment({ fragment, data: { boo: [] }, id: 'Boo:1' });
    expect(cache.extract()).toMatchSnapshot();

    console.log(cache.extract());
  });
});
