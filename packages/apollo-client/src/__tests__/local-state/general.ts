import gql from 'graphql-tag';
import { DocumentNode, GraphQLError } from 'graphql';
import { introspectionQuery } from 'graphql/utilities';

import ApolloClient from '../..';
import { ApolloCache } from 'apollo-cache';
import {
  InMemoryCache,
  IntrospectionFragmentMatcher,
} from 'apollo-cache-inmemory';
import { ApolloLink, Observable } from 'apollo-link';

describe('General functionality', () => {
  it('should not impact normal non-@client use', () => {
    const query = gql`
      {
        field
      }
    `;

    const link = new ApolloLink(() => Observable.of({ data: { field: 1 } }));
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Query: {
          count: () => 0,
        },
      },
    });

    return client.query({ query }).then(({ data }) => {
      expect({ ...data }).toMatchObject({ field: 1 });
    });
  });

  it('should not interfere with server introspection queries', () => {
    const query = gql`
      ${introspectionQuery}
    `;

    const error = new GraphQLError('no introspection result found');
    const link = new ApolloLink(() => Observable.of({ errors: [error] }));

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Query: {
          count: () => 0,
        },
      },
    });

    return client
      .query({ query })
      .then(() => {
        throw new global.Error('should not call');
      })
      .catch((error: GraphQLError) =>
        expect(error.message).toMatch(/no introspection/),
      );
  });

  it('should support returning default values from resolvers', () => {
    const query = gql`
      {
        field @client
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      resolvers: {
        Query: {
          field: () => 1,
        },
      },
    });

    return client.query({ query }).then(({ data }) => {
      expect({ ...data }).toMatchObject({ field: 1 });
    });
  });

  it('should cache data for future lookups', () => {
    const query = gql`
      {
        field @client
      }
    `;

    let count = 0;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      resolvers: {
        Query: {
          field: () => {
            count += 1;
            return 1;
          },
        },
      },
    });

    return client
      .query({ query })
      .then(({ data }) => {
        expect({ ...data }).toMatchObject({ field: 1 });
        expect(count).toBe(1);
      })
      .then(() =>
        client.query({ query }).then(({ data }) => {
          expect({ ...data }).toMatchObject({ field: 1 });
          expect(count).toBe(1);
        }),
      );
  });

  it('should honour `fetchPolicy` settings', () => {
    const query = gql`
      {
        field @client
      }
    `;

    let count = 0;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      resolvers: {
        Query: {
          field: () => {
            count += 1;
            return 1;
          },
        },
      },
    });

    return client
      .query({ query })
      .then(({ data }) => {
        expect({ ...data }).toMatchObject({ field: 1 });
        expect(count).toBe(1);
      })
      .then(() =>
        client
          .query({ query, fetchPolicy: 'network-only' })
          .then(({ data }) => {
            expect({ ...data }).toMatchObject({ field: 1 });
            expect(count).toBe(2);
          }),
      );
  });

  it('should work with a custom fragment matcher', () => {
    const query = gql`
      {
        foo {
          ... on Bar {
            bar @client
          }
          ... on Baz {
            baz @client
          }
        }
      }
    `;

    const link = new ApolloLink(() =>
      Observable.of({
        data: { foo: [{ __typename: 'Bar' }, { __typename: 'Baz' }] },
      }),
    );

    const resolvers = {
      Bar: {
        bar: () => 'Bar',
      },
      Baz: {
        baz: () => 'Baz',
      },
    };

    const fragmentMatcher = (
      { __typename }: { __typename: string },
      typeCondition: string,
    ) => __typename === typeCondition;

    const client = new ApolloClient({
      cache: new InMemoryCache({
        fragmentMatcher: new IntrospectionFragmentMatcher({
          introspectionQueryResultData: {
            __schema: {
              types: [
                {
                  kind: 'UnionTypeDefinition',
                  name: 'Foo',
                  possibleTypes: [{ name: 'Bar' }, { name: 'Baz' }],
                },
              ],
            },
          },
        }),
      }),
      link,
      resolvers,
      fragmentMatcher,
    });

    return client.query({ query }).then(({ data }) => {
      expect(data).toMatchObject({ foo: [{ bar: 'Bar' }, { baz: 'Baz' }] });
    });
  });
});

describe('Cache manipulation', () => {
  it(
    'should be able to query @client fields and the cache without defining ' +
      'local resolvers',
    () => {
      const query = gql`
        {
          field @client
        }
      `;

      const cache = new InMemoryCache();
      const client = new ApolloClient({
        cache,
        link: ApolloLink.empty(),
      });

      cache.writeQuery({ query, data: { field: 'yo' } });

      interface Data {
        field: string;
      }

      client
        .query({ query })
        .then(({ data }) => expect({ ...data }).toMatchObject({ field: 'yo' }));
    },
  );

  it('should be able to write to the cache using a local mutation', () => {
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

    const resolvers = {
      Mutation: {
        start: (_1: any, _2: any, { cache }: { cache: InMemoryCache }) => {
          cache.writeQuery({ query, data: { field: 1 } });
          return { start: true };
        },
      },
    };

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      resolvers,
    });

    return client
      .mutate({ mutation })
      .then(() => client.query({ query }))
      .then(({ data }) => {
        expect({ ...data }).toMatchObject({ field: 1 });
      });
  });

  it(
    'should be able to write to the cache with a local mutation and have ' +
      'things rerender automatically',
    done => {
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

      const resolvers = {
        Query: {
          field: () => 0,
        },
        Mutation: {
          start: (_1: any, _2: any, { cache }: { cache: InMemoryCache }) => {
            cache.writeQuery({ query, data: { field: 1 } });
            return { start: true };
          },
        },
      };

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: ApolloLink.empty(),
        resolvers,
      });

      let count = 0;
      client.watchQuery({ query }).subscribe({
        next: ({ data }) => {
          count++;
          if (count === 1) {
            expect({ ...data }).toMatchObject({ field: 0 });
            client.mutate({ mutation });
          }

          if (count === 2) {
            expect({ ...data }).toMatchObject({ field: 1 });
            done();
          }
        },
      });
    },
  );

  it('should support writing to the cache with a local mutation using variables', () => {
    const query = gql`
      {
        field @client
      }
    `;

    const mutation = gql`
      mutation start($id: ID!) {
        start(field: $id) @client {
          field
        }
      }
    `;

    const resolvers = {
      Mutation: {
        start: (
          _1: any,
          variables: { field: string },
          { cache }: { cache: ApolloCache<any> },
        ) => {
          cache.writeQuery({ query, data: { field: variables.field } });
          return {
            __typename: 'Field',
            field: variables.field,
          };
        },
      },
    };

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      resolvers,
    });

    return client
      .mutate({ mutation, variables: { id: '1234' } })
      .then(({ data }) => {
        expect({ ...data }).toEqual({
          start: { field: '1234', __typename: 'Field' },
        });
      })
      .then(() => client.query({ query }))
      .then(({ data }) => {
        expect({ ...data }).toMatchObject({ field: '1234' });
      });
  });
});

describe('Sample apps', () => {
  it('should support a simple counter app using local state', done => {
    const query = gql`
      query GetCount {
        count @client
        lastCount # stored in db on server
      }
    `;

    const increment = gql`
      mutation Increment($amount: Int = 1) {
        increment(amount: $amount) @client
      }
    `;

    const decrement = gql`
      mutation Decrement($amount: Int = 1) {
        decrement(amount: $amount) @client
      }
    `;

    const link = new ApolloLink(operation => {
      expect(operation.operationName).toBe('GetCount');
      return Observable.of({ data: { lastCount: 1 } });
    });

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const update = (
      query: DocumentNode,
      updater: (data: { count: number }, variables: { amount: number }) => any,
    ) => {
      return (
        result: {},
        variables: { amount: number },
        { cache }: { cache: ApolloCache<any> },
      ): null => {
        const data = updater(client.readQuery({ query, variables }), variables);
        cache.writeQuery({ query, variables, data });
        return null;
      };
    };

    const resolvers = {
      Query: {
        count: () => 0,
      },
      Mutation: {
        increment: update(query, ({ count, ...rest }, { amount }) => ({
          ...rest,
          count: count + amount,
        })),
        decrement: update(query, ({ count, ...rest }, { amount }) => ({
          ...rest,
          count: count - amount,
        })),
      },
    };

    client.addResolvers(resolvers);

    let count = 0;
    client.watchQuery({ query }).subscribe({
      next: ({ data }) => {
        count++;
        if (count === 1) {
          try {
            expect({ ...data }).toMatchObject({ count: 0, lastCount: 1 });
          } catch (e) {
            done.fail(e);
          }
          client.mutate({ mutation: increment, variables: { amount: 2 } });
        }

        if (count === 2) {
          try {
            expect({ ...data }).toMatchObject({ count: 2, lastCount: 1 });
          } catch (e) {
            done.fail(e);
          }
          client.mutate({ mutation: decrement, variables: { amount: 1 } });
        }
        if (count === 3) {
          try {
            expect({ ...data }).toMatchObject({ count: 1, lastCount: 1 });
          } catch (e) {
            done.fail(e);
          }
          done();
        }
      },
      error: e => done.fail(e),
      complete: done.fail,
    });
  });

  it('should support a simple todo app using local state', done => {
    const query = gql`
      query GetTasks {
        todos @client {
          message
          title
        }
      }
    `;

    const mutation = gql`
      mutation AddTodo($message: String, $title: String) {
        addTodo(message: $message, title: $title) @client
      }
    `;

    const client = new ApolloClient({
      link: ApolloLink.empty(),
      cache: new InMemoryCache(),
    });

    interface Todo {
      title: string;
      message: string;
      __typename: string;
    }

    const update = (
      query: DocumentNode,
      updater: (todos, variables) => any,
    ) => {
      return (
        result: {},
        variables: Todo,
        { cache }: { cache: ApolloCache<any> },
      ): null => {
        const data = updater(client.readQuery({ query, variables }), variables);
        cache.writeQuery({ query, variables, data });
        return null;
      };
    };

    const resolvers = {
      Query: {
        todos: () => [],
      },
      Mutation: {
        addTodo: update(query, ({ todos }, { title, message }: Todo) => ({
          todos: todos.concat([{ message, title, __typename: 'Todo' }]),
        })),
      },
    };

    client.addResolvers(resolvers);

    let count = 0;
    client.watchQuery({ query }).subscribe({
      next: ({ data }: any) => {
        count++;
        if (count === 1) {
          expect({ ...data }).toMatchObject({ todos: [] });
          client.mutate({
            mutation,
            variables: {
              title: 'Apollo Client 2.0',
              message: 'ship it',
            },
          });
        } else if (count === 2) {
          expect(data.todos.map((x: Todo) => ({ ...x }))).toMatchObject([
            {
              title: 'Apollo Client 2.0',
              message: 'ship it',
              __typename: 'Todo',
            },
          ]);
          done();
        }
      },
    });
  });
});

describe('Reset/clear store', () => {
  it('should allow initializers to be called after the store is reset', done => {
    const mutation = gql`
      mutation foo {
        foo @client
      }
    `;

    const query = gql`
      {
        foo @client
      }
    `;

    const cache = new InMemoryCache();
    const initializers = {
      foo: () => 'bar',
    };
    const client = new ApolloClient({
      cache,
      link: ApolloLink.empty(),
      initializers,
      resolvers: {
        Mutation: {
          foo: (_, $, { cache }) => {
            cache.writeData({ data: { foo: 'woo' } });
            return null;
          },
        },
      },
    });

    client.onResetStore(() =>
      Promise.resolve(client.runInitializers(initializers)),
    );

    client
      .query({ query })
      .then(({ data }) => {
        expect({ ...data }).toMatchObject({ foo: 'bar' });
      })
      .catch(done.fail);

    client
      .mutate({ mutation })
      .then(() => client.query({ query }))
      .then(({ data }) => {
        expect({ ...data }).toMatchObject({ foo: 'woo' });
      })
      // Should be default after this reset call
      .then(() => client.resetStore())
      .then(() => client.query({ query }))
      .then(({ data }) => {
        expect({ ...data }).toMatchObject({ foo: 'bar' });
        done();
      })
      .catch(done.fail);
  });

  it(
    'should return initializer data after the store is reset, the ' +
      'initializers are re-run, and Query resolver is specified',
    done => {
      const counterQuery = gql`
        query {
          counter @client
        }
      `;

      const plusMutation = gql`
        mutation plus {
          plus @client
        }
      `;

      const cache = new InMemoryCache();
      const initializers = {
        counter: () => 10,
      };
      const client = new ApolloClient({
        cache,
        link: ApolloLink.empty(),
        resolvers: {
          Mutation: {
            plus: (_, __, { cache }) => {
              const { counter } = cache.readQuery({ query: counterQuery });
              const data = {
                counter: counter + 1,
              };
              cache.writeData({ data });
              return null;
            },
          },
        },
        initializers,
      });

      let checkedCount = [10, 11, 12, 10];
      const componentObservable = client.watchQuery({ query: counterQuery });
      componentObservable.subscribe({
        next: ({ data }) => {
          try {
            expect(data).toMatchObject({ counter: checkedCount.shift() });
          } catch (e) {
            done.fail(e);
          }
        },
        error: done.fail,
        complete: done.fail,
      });

      client.onResetStore(() =>
        Promise.resolve(client.runInitializers(initializers)),
      );

      client
        .mutate({ mutation: plusMutation })
        .then(() => {
          expect(cache.readQuery({ query: counterQuery })).toMatchObject({
            counter: 11,
          });
          expect(client.query({ query: counterQuery })).resolves.toMatchObject({
            data: { counter: 11 },
          });
        })
        .then(() => client.mutate({ mutation: plusMutation }))
        .then(() => {
          expect(cache.readQuery({ query: counterQuery })).toMatchObject({
            counter: 12,
          });
          expect(client.query({ query: counterQuery })).resolves.toMatchObject({
            data: { counter: 12 },
          });
        })
        .then(() => client.resetStore() as Promise<null>)
        .then(() => {
          expect(client.query({ query: counterQuery }))
            .resolves.toMatchObject({ data: { counter: 10 } })
            .then(() => {
              expect(checkedCount.length).toBe(0);
              done();
            });
        })
        .catch(done.fail);
    },
  );

  it('should return a Query result via resolver after the store has been reset', async () => {
    const counterQuery = gql`
      query {
        counter @client
      }
    `;

    const plusMutation = gql`
      mutation plus {
        plus @client
      }
    `;

    const cache = new InMemoryCache();
    const initializers = {
      counter: () => 10,
    };
    const client = new ApolloClient({
      cache,
      link: ApolloLink.empty(),
      resolvers: {
        Query: {
          counter: () => 0,
        },
        Mutation: {
          plus: (_, __, { cache }) => {
            const { counter } = cache.readQuery({ query: counterQuery });
            const data = {
              counter: counter + 1,
            };
            cache.writeData({ data });
            return null;
          },
        },
      },
      initializers,
    });

    await client.mutate({ mutation: plusMutation });
    expect(cache.readQuery({ query: counterQuery })).toMatchObject({
      counter: 11,
    });

    await client.mutate({ mutation: plusMutation });
    expect(cache.readQuery({ query: counterQuery })).toMatchObject({
      counter: 12,
    });
    await expect(client.query({ query: counterQuery })).resolves.toMatchObject({
      data: { counter: 12 },
    });

    (client.resetStore() as Promise<null>)
      .then(() => {
        expect(client.query({ query: counterQuery }))
          .resolves.toMatchObject({ data: { counter: 0 } })
          .catch(fail);
      })
      .catch(fail);
  });

  it(
    'should return default data from the cache in a Query resolver after ' +
      'the store has been reset, and intializers have been re-run',
    async () => {
      const counterQuery = gql`
        query {
          counter @client
        }
      `;

      const plusMutation = gql`
        mutation plus {
          plus @client
        }
      `;

      const cache = new InMemoryCache();
      const initializers = {
        counter: () => 10,
      };
      const client = new ApolloClient({
        cache,
        link: ApolloLink.empty(),
        resolvers: {
          Query: {
            counter: () => {
              return (cache.readQuery({ query: counterQuery }) as any).counter;
            },
          },
          Mutation: {
            plus: (_, __, { cache }) => {
              const { counter } = cache.readQuery({ query: counterQuery });
              const data = {
                counter: counter + 1,
              };
              cache.writeData({ data });
              return null;
            },
          },
        },
        initializers,
      });

      client.onResetStore(() =>
        Promise.resolve(client.runInitializers(initializers)),
      );

      await client.mutate({ mutation: plusMutation });
      await client.mutate({ mutation: plusMutation });
      expect(cache.readQuery({ query: counterQuery })).toMatchObject({
        counter: 12,
      });
      const result = await client.query({ query: counterQuery });
      expect(result).toMatchObject({
        data: { counter: 12 },
      });

      let called = false;
      const componentObservable = client.watchQuery({ query: counterQuery });

      const unsub = componentObservable.subscribe({
        next: ({ data }) => {
          try {
            if (called) {
              expect(data).toMatchObject({ counter: 10 });
            }
            called = true;
          } catch (e) {
            fail(e);
          }
        },
        error: fail,
        complete: fail,
      });

      const makeTerminatingCheck = (body, done) => {
        return (...args) => {
          try {
            body(...args);
            done();
          } catch (error) {
            fail(error);
          }
        };
      };

      try {
        await client.resetStore();
      } catch (error) {
        // Do nothing
      }

      expect(client.query({ query: counterQuery }))
        .resolves.toMatchObject({ data: { counter: 10 } })
        .then(
          makeTerminatingCheck(
            () => {
              unsub.unsubscribe();
            },
            () => {
              expect(called);
            },
          ),
        )
        .catch(fail);
    },
  );

  it(
    'should not find data in the cache via a Query resolver if the store ' +
      'is reset and initializers are not re-run',
    done => {
      const counterQuery = gql`
        query {
          counter @client
        }
      `;

      const cache = new InMemoryCache();
      const initializers = {
        counter: () => 10,
      };
      const client = new ApolloClient({
        cache,
        link: ApolloLink.empty(),
        resolvers: {
          Query: {
            counter: () => {
              try {
                return (cache.readQuery({ query: counterQuery }) as any)
                  .counter;
              } catch (error) {
                try {
                  expect(error.message).toMatch(/field counter/);
                } catch (e) {
                  done.fail(e);
                }
                unsub.unsubscribe();
                done();
              }
              return -1; // to remove warning from in-memory-cache
            },
          },
        },
        initializers,
      });

      const componentObservable = client.watchQuery({ query: counterQuery });

      const unsub = componentObservable.subscribe({
        next: ({ data }) => done.fail,
        error: done.fail,
        complete: done.fail,
      });

      client.resetStore() as Promise<null>;
    },
  );

  it(
    "should warn when an initializer created default value can't be found " +
      "in the cache, and a matching Query resolver can't be found",
    async done => {
      const counterQuery = gql`
        query {
          counter @client
        }
      `;

      const plusMutation = gql`
        mutation plus {
          plus @client
        }
      `;

      const cache = new InMemoryCache();
      const initializers = {
        counter: () => 10,
      };
      const client = new ApolloClient({
        cache,
        link: ApolloLink.empty(),
        resolvers: {
          Query: {
            counter: () => {},
          },
          Mutation: {
            plus: (_, __, { cache }) => {
              const { counter } = cache.readQuery({ query: counterQuery });
              const data = {
                counter: counter + 1,
              };
              cache.writeData({ data });
              return null;
            },
          },
        },
        initializers,
      });

      let realWarn = console.warn;
      console.warn = message => {
        unsub.unsubscribe();
        console.warn = realWarn;
        done();
      };

      await client.mutate({ mutation: plusMutation });

      const componentObservable = client.watchQuery({ query: counterQuery });

      let calledOnce = true;
      const unsub = componentObservable.subscribe({
        next: data => {
          try {
            expect(calledOnce);
            calledOnce = false;
          } catch (e) {
            done.fail(e);
          }
        },
        error: done.fail,
        complete: done.fail,
      });

      client.resetStore();
    },
  );
});
