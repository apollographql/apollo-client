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

    interface Data {
      field: number;
    }

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

    return client.query({ query }).then(({ data }: { data: Data }) => {
      expect({ ...data }).toMatchObject({ field: 1 });
    });
  });

  it('should not interfere with server introspection queries', () => {
    const query = gql`
      ${introspectionQuery}
    `;

    const link = new ApolloLink(() =>
      Observable.of({ errors: [{ message: 'no introspection result found' }] }),
    );

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

    interface Data {
      field: number;
    }

    return client.query({ query }).then(({ data }: { data: Data }) => {
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

    interface Data {
      field: number;
    }

    return client
      .query({ query })
      .then(({ data }: { data: Data }) => {
        expect({ ...data }).toMatchObject({ field: 1 });
        expect(count).toBe(1);
      })
      .then(() =>
        client.query({ query }).then(({ data }: { data: Data }) => {
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

    interface Data {
      field: number;
    }

    return client
      .query({ query })
      .then(({ data }: { data: Data }) => {
        expect({ ...data }).toMatchObject({ field: 1 });
        expect(count).toBe(1);
      })
      .then(() =>
        client
          .query({ query, fetchPolicy: 'network-only' })
          .then(({ data }: { data: Data }) => {
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

    interface Data {
      food: object[];
    }

    return client.query({ query }).then(({ data }: { data: Data }) => {
      expect(data).toMatchObject({ foo: [{ bar: 'Bar' }, { baz: 'Baz' }] });
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
      updater: (todos: Todo[], variables: Todo) => any,
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
