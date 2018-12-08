import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloLink } from 'apollo-link';
import gql from 'graphql-tag';

import ApolloClient from '../..';

describe('Initializers called during ApolloClient instantiation', () => {
  it('should write the result of initiailizer functions to the cache', () => {
    const cache = new InMemoryCache();
    new ApolloClient({
      cache,
      link: ApolloLink.empty(),
      initializers: {
        foo: () => ({ bar: false, __typename: 'Bar' }),
      },
      resolvers: {
        Query: {
          foo: () => ({ bar: true }),
        },
      },
    });
    expect(cache.extract()).toMatchSnapshot();
  });

  it('should not call the resolver if the data is already in the cache', () => {
    const fooResolver = jest.fn();
    const resolvers = { Query: { foo: fooResolver } };

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link: ApolloLink.empty(),
      initializers: {
        foo: () => ({ bar: false, __typename: 'Bar' }),
      },
      resolvers,
    });

    const query = gql`
      {
        foo @client {
          bar
        }
      }
    `;

    client
      .query({ query })
      .then(({ data }) => {
        expect(fooResolver).not.toHaveBeenCalled();
      })
      .catch(e => console.error(e));
  });
});

describe('Initializers called via runInitializers', () => {
  it('should run initializers asynchronously', async () => {
    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link: ApolloLink.empty(),
    });

    client.runInitializers({
      primaryUserId: () => 100,
    });
    expect(cache.extract()).toEqual({});

    await client.runInitializers({
      secondaryUserId: () => 200,
    });
    expect(cache.extract()).toEqual({
      ROOT_QUERY: {
        primaryUserId: 100,
        secondaryUserId: 200,
      },
    });
  });
});
