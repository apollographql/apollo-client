import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloLink } from 'apollo-link';
import gql from 'graphql-tag';

import ApolloClient from '../..';

describe('General', () => {
  it('should write the result of initiailizer functions to the cache', () => {
    const cache = new InMemoryCache();
    new ApolloClient({
      cache,
      initializers: {
        foo: () => ({ bar: false, __typename: 'Bar' }),
      },
      resolvers: {
        Query: {
          foo: () => ({ bar: true }),
        },
      },
    });
    expect(cache.extract()).toEqual({
      '$ROOT_QUERY.foo': {
        bar: false,
        __typename: 'Bar',
      },
      ROOT_QUERY: {
        foo: {
          generated: true,
          id: '$ROOT_QUERY.foo',
          type: 'id',
          typename: 'Bar',
        },
      },
    });
  });

  it(
    'should not attempt to write the return value of an initializer ' +
      'function if it returns `undefined`',
    async done => {
      const firstNameQuery = gql`
        query FirstName {
          firstName @client
        }
      `;

      const lastNameQuery = gql`
        query LastName {
          lastName @client
        }
      `;

      const firstName = 'John';
      const lastName = 'Smith';

      const cache = new InMemoryCache();
      const client = new ApolloClient({
        cache,
        initializers: {
          firstName() {
            cache.writeQuery({
              query: firstNameQuery,
              data: {
                firstName,
              },
            });
          },
          lastName() {
            return lastName;
          },
        },
      });

      const {
        data: { firstName: loadedFirstName },
      } = await client.query({ query: firstNameQuery });
      expect(loadedFirstName).toEqual(firstName);
      const {
        data: { lastName: loadedLastName },
      } = await client.query({ query: lastNameQuery });
      expect(loadedLastName).toEqual(lastName);
      return done();
    },
  );

  it('should be able to write `null` values to the cache from an initializer', async done => {
    const firstNameQuery = gql`
      query FirstName {
        firstName @client
      }
    `;

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      initializers: {
        firstName() {
          return null;
        },
      },
    });

    const { data } = await client.query({ query: firstNameQuery });
    expect(data).not.toBe(null);
    expect(data.firstName).toBe(null);
    return done();
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
      .then(() => {
        expect(fooResolver).not.toHaveBeenCalled();
      })
      .catch(e => console.error(e));
  });
});

describe('#runInitializers', () => {
  it('should run initializers asynchronously', async (done) => {
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

    return done();
  });

  it(
    'should prevent initializers from running more than once, by default',
    async (done) => {
      const cache = new InMemoryCache();
      const client = new ApolloClient({
        cache,
        link: ApolloLink.empty(),
      });

      await client.runInitializers({
        primaryUserId: () => 100,
      });
      expect(cache.extract()).toEqual({
        ROOT_QUERY: {
          primaryUserId: 100,
        },
      });

      const spy =
        jest.spyOn(global.console, 'warn').mockImplementation(() => {});
      await client.runInitializers({
        primaryUserId: () => 100,
      });
      expect(spy).toBeCalled();
      spy.mockRestore();
      return done();
    }
  );

  it(
    'should be able to run initializers a second time after calling ' +
    '`ApolloClient.resetInitializers()`',
    async (done) => {
      const cache = new InMemoryCache();
      const client = new ApolloClient({
        cache,
        link: ApolloLink.empty(),
      });

      await client.runInitializers({
        primaryUserId: () => 100,
      });
      expect(cache.extract()).toEqual({
        ROOT_QUERY: {
          primaryUserId: 100,
        },
      });

      client.resetInitializers();

      const spy =
        jest.spyOn(global.console, 'warn').mockImplementation(() => {});
      await client.runInitializers({
        primaryUserId: () => 200,
      });
      expect(spy).not.toBeCalled();
      spy.mockRestore();

      expect(cache.extract()).toEqual({
        ROOT_QUERY: {
          primaryUserId: 200,
        },
      });
      return done();
    }
  );
});
