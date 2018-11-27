import gql from 'graphql-tag';
import { DocumentNode, ExecutionResult } from 'graphql';
import { assign } from 'lodash';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloLink, Observable } from 'apollo-link';

import ApolloClient from '../..';
import mockQueryManager from '../../__mocks__/mockQueryManager';
import { Observer } from '../../util/Observable';
import wrap from '../../util/wrap';
import { ApolloQueryResult, Resolvers } from '../../core/types';
import { WatchQueryOptions } from '../../core/watchQueryOptions';

// Helper method that sets up a mockQueryManager and then passes on the
// results to an observer.
const assertWithObserver = ({
  done,
  resolvers,
  query,
  serverQuery,
  variables = {},
  queryOptions = {},
  serverResult,
  error,
  delay,
  observer,
}: {
  done: jest.DoneCallback;
  resolvers?: Resolvers;
  query: DocumentNode;
  serverQuery?: DocumentNode;
  variables?: object;
  queryOptions?: object;
  error?: Error;
  serverResult?: ExecutionResult;
  delay?: number;
  observer: Observer<ApolloQueryResult<any>>;
}) => {
  const queryManager = mockQueryManager({
    request: { query: serverQuery, variables },
    result: serverResult,
    error,
    delay,
  });

  if (resolvers) {
    queryManager.addResolvers(resolvers);
  }

  const finalOptions = assign(
    { query, variables },
    queryOptions,
  ) as WatchQueryOptions;
  return queryManager.watchQuery<any>(finalOptions).subscribe({
    next: wrap(done, observer.next!),
    error: observer.error,
  });
};

describe('Basic resolver capabilities', () => {
  it('should run resolvers for @client queries', done => {
    const query = gql`
      query Test {
        foo @client {
          bar
        }
      }
    `;

    const resolvers = {
      Query: {
        foo: () => ({ bar: true }),
      },
    };

    assertWithObserver({
      done,
      resolvers,
      query,
      observer: {
        next({ data }) {
          try {
            expect(data).toEqual({ foo: { bar: true } });
          } catch (error) {
            done.fail(error);
          }
          done();
        },
      },
    });
  });

  it('should handle queries with a mix of @client and server fields', done => {
    const query = gql`
      query Mixed {
        foo @client {
          bar
        }
        bar {
          baz
        }
      }
    `;

    const serverQuery = gql`
      query Mixed {
        bar {
          baz
        }
      }
    `;

    const resolvers = {
      Query: {
        foo: () => ({ bar: true }),
      },
    };

    assertWithObserver({
      done,
      resolvers,
      query,
      serverQuery,
      serverResult: { data: { bar: { baz: true } } },
      observer: {
        next({ data }) {
          try {
            expect(data).toEqual({ foo: { bar: true }, bar: { baz: true } });
          } catch (error) {
            done.fail(error);
          }
          done();
        },
      },
    });
  });

  it('should handle a mix of @client fields with fragments and server fields', done => {
    const query = gql`
      fragment client on ClientData {
        bar
        __typename
      }

      query Mixed {
        foo @client {
          ...client
        }
        bar {
          baz
        }
      }
    `;

    const serverQuery = gql`
      fragment client on ClientData {
        bar
        __typename
      }
      query Mixed {
        bar {
          baz
        }
      }
    `;

    const resolvers = {
      Query: {
        foo: () => ({ bar: true, __typename: 'ClientData' }),
      },
    };

    assertWithObserver({
      done,
      resolvers,
      query,
      serverQuery,
      serverResult: { data: { bar: { baz: true, __typename: 'Bar' } } },
      observer: {
        next({ data }) {
          try {
            expect(data).toEqual({
              foo: { bar: true, __typename: 'ClientData' },
              bar: { baz: true },
            });
          } catch (error) {
            done.fail(error);
          }
          done();
        },
      },
    });
  });

  it('should have access to query variables when running @client resolvers', done => {
    const query = gql`
      query WithVariables($id: ID!) {
        foo @client {
          bar(id: $id)
        }
      }
    `;

    const resolvers = {
      Query: {
        foo: () => ({ __typename: 'Foo' }),
      },
      Foo: {
        bar: (data: any, { id }: { id: number }) => id,
      },
    };

    assertWithObserver({
      done,
      resolvers,
      query,
      variables: { id: 1 },
      observer: {
        next({ data }) {
          try {
            expect(data).toEqual({ foo: { bar: 1 } });
          } catch (error) {
            done.fail(error);
          }
          done();
        },
      },
    });
  });

  it('should pass context to @client resolvers', done => {
    const query = gql`
      query WithContext {
        foo @client {
          bar
        }
      }
    `;

    const resolvers = {
      Query: {
        foo: () => ({ __typename: 'Foo' }),
      },
      Foo: {
        bar: (data: any, _: any, { id }: { id: number }) => id,
      },
    };

    assertWithObserver({
      done,
      resolvers,
      query,
      queryOptions: { context: { id: 1 } },
      observer: {
        next({ data }) {
          try {
            expect(data).toEqual({ foo: { bar: 1 } });
          } catch (error) {
            done.fail(error);
          }
          done();
        },
      },
    });
  });
});

describe('Writing cache data from resolvers', () => {
  it('should let you write to the cache with a mutation', () => {
    const query = gql`
      {
        field @client
      }
    `;

    const mutation = gql`
      mutation start {
        start @client
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      resolvers: {
        Mutation: {
          start: (_, $, { cache }) => {
            cache.writeData({ data: { field: 1 } });
            return { start: true };
          },
        },
      },
    });

    return client
      .mutate({ mutation })
      .then(() => client.query({ query }))
      .then(({ data }) => {
        expect({ ...data }).toMatchObject({ field: 1 });
      });
  });

  it('should let you write to the cache with a mutation using an ID', () => {
    const query = gql`
      {
        obj @client {
          field
        }
      }
    `;

    const mutation = gql`
      mutation start {
        start @client
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      resolvers: {
        Mutation: {
          start: (_, $, { cache }) => {
            cache.writeQuery({
              query,
              data: {
                obj: { field: 1, id: 'uniqueId', __typename: 'Object' },
              },
            });
            cache.writeData({ id: 'Object:uniqueId', data: { field: 2 } });
            return { start: true };
          },
        },
      },
    });

    return client
      .mutate({ mutation })
      .then(() => client.query({ query }))
      .then(({ data }: any) => {
        expect(data.obj.field).toEqual(2);
      });
  });

  it('should not overwrite __typename when writing to the cache with an id', () => {
    const query = gql`
      {
        obj @client {
          field {
            field2
          }
          id
        }
      }
    `;

    const mutation = gql`
      mutation start {
        start @client
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      resolvers: {
        Mutation: {
          start: (_, $, { cache }) => {
            cache.writeQuery({
              query,
              data: {
                obj: {
                  field: { field2: 1, __typename: 'Field' },
                  id: 'uniqueId',
                  __typename: 'Object',
                },
              },
            });
            cache.writeData({
              id: 'Object:uniqueId',
              data: { field: { field2: 2, __typename: 'Field' } },
            });
            return { start: true };
          },
        },
      },
    });

    return client
      .mutate({ mutation })
      .then(() => client.query({ query }))
      .then(({ data }: any) => {
        expect(data.obj.__typename).toEqual('Object');
        expect(data.obj.field.__typename).toEqual('Field');
      })
      .catch(e => console.log(e));
  });

  it(
    'should add a __typename for an object without one when writing to the ' +
      'cache with an id',
    () => {
      const query = gql`
        {
          obj @client {
            field {
              field2
            }
            id
          }
        }
      `;

      const mutation = gql`
        mutation start {
          start @client
        }
      `;

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: ApolloLink.empty(),
        resolvers: {
          Mutation: {
            start: (_, $, { cache }) => {
              // This would cause a warning to be printed because we don't have
              // __typename on the obj field. But that's intentional because
              // that's exactly the situation we're trying to test...

              // Let's swap out console.warn to suppress this one message
              const suppressString = '__typename';
              const originalWarn = console.warn;
              console.warn = (...args: any[]) => {
                if (
                  args.find(element => {
                    if (typeof element === 'string') {
                      return element.indexOf(suppressString) !== -1;
                    }
                    return false;
                  }) != null
                ) {
                  // Found a thing in the args we told it to exclude
                  return;
                }
                originalWarn.apply(console, args);
              };
              // Actually call the problematic query
              cache.writeQuery({
                query,
                data: {
                  obj: {
                    field: { field2: 1, __typename: 'Field' },
                    id: 'uniqueId',
                  },
                },
              });
              // Restore warning logger
              console.warn = originalWarn;

              cache.writeData({
                id: '$ROOT_QUERY.obj',
                data: { field: { field2: 2, __typename: 'Field' } },
              });
              return { start: true };
            },
          },
        },
      });

      return client
        .mutate({ mutation })
        .then(() => client.query({ query }))
        .then(({ data }: any) => {
          expect(data.obj.__typename).toEqual('__ClientData');
          expect(data.obj.field.__typename).toEqual('Field');
        })
        .catch(e => console.log(e));
    },
  );
});

describe('Resolving field aliases', () => {
  it('should run resolvers for missing client queries with aliased field', done => {
    // expect.assertions(1);
    const query = gql`
      query Aliased {
        foo @client {
          bar
        }
        baz: bar {
          foo
        }
      }
    `;

    const link = new ApolloLink(() =>
      // Each link is responsible for implementing their own aliasing so it
      // returns baz not bar
      Observable.of({ data: { baz: { foo: true, __typename: 'Baz' } } }),
    );

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Query: {
          foo: () => ({ bar: true, __typename: 'Foo' }),
        },
      },
    });

    client.query({ query }).then(({ data }) => {
      try {
        expect(data).toEqual({
          foo: { bar: true, __typename: 'Foo' },
          baz: { foo: true, __typename: 'Baz' },
        });
      } catch (e) {
        done.fail(e);
        return;
      }
      done();
    }, done.fail);
  });

  it(
    'should run resolvers for client queries when aliases are in use on ' +
      'the @client-tagged node',
    done => {
      const aliasedQuery = gql`
        query Test {
          fie: foo @client {
            bar
          }
        }
      `;

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: ApolloLink.empty(),
        resolvers: {
          Query: {
            foo: () => ({ bar: true, __typename: 'Foo' }),
            fie: () => {
              done.fail(
                "Called the resolver using the alias' name, instead of " +
                  'the correct resolver name.',
              );
            },
          },
        },
      });

      client.query({ query: aliasedQuery }).then(({ data }) => {
        expect(data).toEqual({ fie: { bar: true, __typename: 'Foo' } });
        done();
      }, done.fail);
    },
  );

  it('should respect aliases for *nested fields* on the @client-tagged node', done => {
    const aliasedQuery = gql`
      query Test {
        fie: foo @client {
          fum: bar
        }
        baz: bar {
          foo
        }
      }
    `;

    const link = new ApolloLink(() =>
      Observable.of({ data: { baz: { foo: true, __typename: 'Baz' } } }),
    );

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Query: {
          foo: () => ({ bar: true, __typename: 'Foo' }),
          fie: () => {
            done.fail(
              "Called the resolver using the alias' name, instead of " +
                'the correct resolver name.',
            );
          },
        },
      },
    });

    client.query({ query: aliasedQuery }).then(({ data }) => {
      expect(data).toEqual({
        fie: { fum: true, __typename: 'Foo' },
        baz: { foo: true, __typename: 'Baz' },
      });
      done();
    }, done.fail);
  });

  it(
    'should pull initialized values for aliased fields tagged with @client ' +
      'from the cache',
    () => {
      const query = gql`
        {
          fie: foo @client {
            bar
          }
        }
      `;

      const cache = new InMemoryCache();
      const client = new ApolloClient({
        cache,
        link: ApolloLink.empty(),
        initializers: {
          foo: () => ({
            bar: 'yo',
            __typename: 'Foo',
          }),
        },
      });

      return client.query({ query }).then(({ data }) => {
        expect({ ...data }).toMatchObject({
          fie: { bar: 'yo', __typename: 'Foo' },
        });
      });
    },
  );
});
