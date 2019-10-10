import { cloneDeep } from 'lodash';
import gql from 'graphql-tag';

import { Observable, Subscription } from '../utilities/observables/Observable';
import { ApolloLink } from '../link/core/ApolloLink';
import { mockSingleLink } from '../__mocks__/mockLinks';
import { ApolloClient } from '..';
import { InMemoryCache } from '../cache/inmemory/inMemoryCache';
import { withWarning } from './utils/wrap';

describe('mutation results', () => {
  const query = gql`
    query todoList {
      todoList(id: 5) {
        id
        todos {
          id
          text
          completed
        }
        filteredTodos: todos(completed: true) {
          id
          text
          completed
        }
      }
      noIdList: todoList(id: 6) {
        id
        todos {
          text
          completed
        }
      }
    }
  `;

  const queryWithTypename = gql`
    query todoList {
      todoList(id: 5) {
        id
        todos {
          id
          text
          completed
          __typename
        }
        filteredTodos: todos(completed: true) {
          id
          text
          completed
          __typename
        }
        __typename
      }
      noIdList: todoList(id: 6) {
        id
        todos {
          text
          completed
          __typename
        }
        __typename
      }
    }
  `;

  const result: any = {
    data: {
      __typename: 'Query',
      todoList: {
        __typename: 'TodoList',
        id: '5',
        todos: [
          {
            __typename: 'Todo',
            id: '3',
            text: 'Hello world',
            completed: false,
          },
          {
            __typename: 'Todo',
            id: '6',
            text: 'Second task',
            completed: false,
          },
          {
            __typename: 'Todo',
            id: '12',
            text: 'Do other stuff',
            completed: false,
          },
        ],
        filteredTodos: [],
      },
      noIdList: {
        __typename: 'TodoList',
        id: '7',
        todos: [
          {
            __typename: 'Todo',
            text: 'Hello world',
            completed: false,
          },
          {
            __typename: 'Todo',
            text: 'Second task',
            completed: false,
          },
          {
            __typename: 'Todo',
            text: 'Do other stuff',
            completed: false,
          },
        ],
      },
    },
  };

  let client: ApolloClient<any>;
  let link: any;

  function setupObsHandle(...mockedResponses: any[]) {
    link = mockSingleLink(
      {
        request: { query: queryWithTypename } as any,
        result,
      },
      ...mockedResponses,
    );

    client = new ApolloClient({
      link,
      cache: new InMemoryCache({
        dataIdFromObject: (obj: any) => {
          if (obj.id && obj.__typename) {
            return obj.__typename + obj.id;
          }
          return null;
        },
        // Passing an empty map enables warnings about missing fields:
        possibleTypes: {},
      }),
    });

    return client.watchQuery({
      query,
      notifyOnNetworkStatusChange: false,
    });
  }

  function setupDelayObsHandle(delay: number, ...mockedResponses: any[]) {
    link = mockSingleLink(
      {
        request: { query: queryWithTypename } as any,
        result,
        delay,
      },
      ...mockedResponses,
    );

    client = new ApolloClient({
      link,
      cache: new InMemoryCache({
        dataIdFromObject: (obj: any) => {
          if (obj.id && obj.__typename) {
            return obj.__typename + obj.id;
          }
          return null;
        },
        // Passing an empty map enables warnings about missing fields:
        possibleTypes: {},
      }),
    });

    return client.watchQuery({
      query,
      notifyOnNetworkStatusChange: false,
    });
  }

  function setup(...mockedResponses: any[]) {
    const obsHandle = setupObsHandle(...mockedResponses);
    return obsHandle.result();
  }

  it('correctly primes cache for tests', () => {
    return setup().then(() =>
      client.query({
        query,
      }),
    );
  });

  it('correctly integrates field changes by default', () => {
    const mutation = gql`
      mutation setCompleted {
        setCompleted(todoId: "3") {
          id
          completed
          __typename
        }
        __typename
      }
    `;

    const mutationResult = {
      data: {
        __typename: 'Mutation',
        setCompleted: {
          __typename: 'Todo',
          id: '3',
          completed: true,
        },
      },
    };

    return setup({
      request: { query: mutation },
      result: mutationResult,
    })
      .then(() => {
        return client.mutate({ mutation });
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        expect(newResult.data.todoList.todos[0].completed).toBe(true);
      });
  });
  it('correctly integrates field changes by default with variables', done => {
    const query = gql`
      query getMini($id: ID!) {
        mini(id: $id) {
          id
          cover(maxWidth: 600, maxHeight: 400)
          __typename
        }
      }
    `;
    const mutation = gql`
      mutation upload($signature: String!) {
        mini: submitMiniCoverS3DirectUpload(signature: $signature) {
          id
          cover(maxWidth: 600, maxHeight: 400)
          __typename
        }
      }
    `;

    const link = mockSingleLink(
      {
        request: {
          query,
          variables: { id: 1 },
        } as any,
        delay: 100,
        result: {
          data: { mini: { id: 1, cover: 'image', __typename: 'Mini' } },
        },
      },
      {
        request: {
          query: mutation,
          variables: { signature: '1234' },
        } as any,
        delay: 150,
        result: {
          data: { mini: { id: 1, cover: 'image2', __typename: 'Mini' } },
        },
      },
    );

    interface Data {
      mini: { id: number; cover: string; __typename: string };
    }
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({
        dataIdFromObject: (obj: any) => {
          if (obj.id && obj.__typename) {
            return obj.__typename + obj.id;
          }
          return null;
        },
      }),
    });

    const obs = client.watchQuery<Data>({
      query,
      variables: { id: 1 },
      notifyOnNetworkStatusChange: false,
    });

    let count = 0;
    obs.subscribe({
      next: result => {
        if (count === 0) {
          client.mutate({ mutation, variables: { signature: '1234' } });
          expect(result.data.mini.cover).toBe('image');

          setTimeout(() => {
            if (count === 0)
              done.fail(
                new Error('mutate did not re-call observable with next value'),
              );
          }, 250);
        }
        if (count === 1) {
          expect(result.data.mini.cover).toBe('image2');
          done();
        }
        count++;
      },
      error: done.fail,
    });
  });

  it("should warn when the result fields don't match the query fields", () => {
    let handle: any;
    let subscriptionHandle: Subscription;
    let counter = 0;

    const queryTodos = gql`
      query todos {
        todos {
          id
          name
          description
          __typename
        }
      }
    `;

    const queryTodosResult = {
      data: {
        todos: [
          {
            id: '1',
            name: 'Todo 1',
            description: 'Description 1',
            __typename: 'todos',
          },
        ],
      },
    };

    const mutationTodo = gql`
      mutation createTodo {
        createTodo {
          id
          name
          # missing field: description
          __typename
        }
      }
    `;

    const mutationTodoResult = {
      data: {
        createTodo: {
          id: '2',
          name: 'Todo 2',
          __typename: 'createTodo',
        },
      },
    };

    return withWarning(() => {
      return setup(
        {
          request: { query: queryTodos },
          result: queryTodosResult,
        },
        {
          request: { query: mutationTodo },
          result: mutationTodoResult,
        },
      )
        .then(() => {
          // we have to actually subscribe to the query to be able to update it
          return new Promise(resolve => {
            handle = client.watchQuery({ query: queryTodos });
            subscriptionHandle = handle.subscribe({
              next(res: any) {
                counter++;
                resolve(res);
              },
            });
          });
        })
        .then(() => {
          return client.mutate({
            mutation: mutationTodo,
            updateQueries: {
              todos: (prev, { mutationResult }) => {
                const newTodo = (mutationResult as any).data.createTodo;

                const newResults = {
                  todos: [...(prev as any).todos, newTodo],
                };
                return newResults;
              },
            },
          });
        })
        .then(() => subscriptionHandle.unsubscribe());
    }, /Missing field description/);
  });

  describe('updateQueries', () => {
    const mutation = gql`
      mutation createTodo {
        # skipping arguments in the test since they don't matter
        createTodo {
          id
          text
          completed
          __typename
        }
        __typename
      }
    `;

    const mutationResult = {
      data: {
        __typename: 'Mutation',
        createTodo: {
          id: '99',
          __typename: 'Todo',
          text: 'This one was created with a mutation.',
          completed: true,
        },
      },
    };

    it('analogous of ARRAY_INSERT', () => {
      let subscriptionHandle: Subscription;
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
        .then(() => {
          // we have to actually subscribe to the query to be able to update it
          return new Promise(resolve => {
            const handle = client.watchQuery({ query });
            subscriptionHandle = handle.subscribe({
              next(res) {
                resolve(res);
              },
            });
          });
        })
        .then(() => {
          return client.mutate({
            mutation,
            updateQueries: {
              todoList: (prev, options) => {
                const mResult = options.mutationResult as any;
                expect(mResult.data.createTodo.id).toBe('99');
                expect(mResult.data.createTodo.text).toBe(
                  'This one was created with a mutation.',
                );

                const state = cloneDeep(prev) as any;
                state.todoList.todos.unshift(mResult.data.createTodo);
                return state;
              },
            },
          });
        })
        .then(() => {
          return client.query({ query });
        })
        .then((newResult: any) => {
          subscriptionHandle.unsubscribe();

          // There should be one more todo item than before
          expect(newResult.data.todoList.todos.length).toBe(4);

          // Since we used `prepend` it should be at the front
          expect(newResult.data.todoList.todos[0].text).toBe(
            'This one was created with a mutation.',
          );
        });
    });

    it('does not fail if optional query variables are not supplied', () => {
      let subscriptionHandle: Subscription;
      const mutationWithVars = gql`
        mutation createTodo($requiredVar: String!, $optionalVar: String) {
          createTodo(requiredVar: $requiredVar, optionalVar: $optionalVar) {
            id
            text
            completed
            __typename
          }
          __typename
        }
      `;

      // the test will pass if optionalVar is uncommented
      const variables = {
        requiredVar: 'x',
        // optionalVar: 'y',
      };
      return setup({
        request: {
          query: mutationWithVars,
          variables,
        },
        result: mutationResult,
      })
        .then(() => {
          // we have to actually subscribe to the query to be able to update it
          return new Promise(resolve => {
            const handle = client.watchQuery({
              query,
              variables,
            });
            subscriptionHandle = handle.subscribe({
              next(res) {
                resolve(res);
              },
            });
          });
        })
        .then(() => {
          return client.mutate({
            mutation: mutationWithVars,
            variables,
            updateQueries: {
              todoList: (prev, options) => {
                const mResult = options.mutationResult as any;
                expect(mResult.data.createTodo.id).toBe('99');
                expect(mResult.data.createTodo.text).toBe(
                  'This one was created with a mutation.',
                );

                const state = cloneDeep(prev) as any;
                state.todoList.todos.unshift(mResult.data.createTodo);
                return state;
              },
            },
          });
        })
        .then(() => {
          return client.query({ query });
        })
        .then((newResult: any) => {
          subscriptionHandle.unsubscribe();

          // There should be one more todo item than before
          expect(newResult.data.todoList.todos.length).toBe(4);

          // Since we used `prepend` it should be at the front
          expect(newResult.data.todoList.todos[0].text).toBe(
            'This one was created with a mutation.',
          );
        });
    });

    it('does not fail if the query did not complete correctly', () => {
      const obsHandle = setupObsHandle({
        request: { query: mutation },
        result: mutationResult,
      });
      const subs = obsHandle.subscribe({
        next: () => null,
      });
      // Cancel the query right away!
      subs.unsubscribe();
      return client.mutate({
        mutation,
        updateQueries: {
          todoList: (prev, options) => {
            const mResult = options.mutationResult as any;
            expect(mResult.data.createTodo.id).toBe('99');
            expect(mResult.data.createTodo.text).toBe(
              'This one was created with a mutation.',
            );

            const state = cloneDeep(prev) as any;
            state.todoList.todos.unshift(mResult.data.createTodo);
            return state;
          },
        },
      });
    });

    it('does not fail if the query did not finish loading', () => {
      const obsHandle = setupDelayObsHandle(15, {
        request: { query: mutation },
        result: mutationResult,
      });
      obsHandle.subscribe({
        next: () => null,
      });
      return client.mutate({
        mutation,
        updateQueries: {
          todoList: (prev, options) => {
            const mResult = options.mutationResult as any;
            expect(mResult.data.createTodo.id).toBe('99');
            expect(mResult.data.createTodo.text).toBe(
              'This one was created with a mutation.',
            );

            const state = cloneDeep(prev) as any;
            state.todoList.todos.unshift(mResult.data.createTodo);
            return state;
          },
        },
      });
    });

    it('does not make next queries fail if a mutation fails', done => {
      const obsHandle = setupObsHandle(
        {
          request: { query: mutation },
          result: { errors: [new Error('mock error')] },
        },
        {
          request: { query: queryWithTypename },
          result,
        },
      );

      obsHandle.subscribe({
        next() {
          client
            .mutate({
              mutation,
              updateQueries: {
                todoList: (prev, options) => {
                  const mResult = options.mutationResult as any;
                  const state = cloneDeep(prev) as any;
                  // It's unfortunate that this function is called at all, but we are removing
                  // the updateQueries API soon so it won't matter.
                  state.todoList.todos.unshift(
                    mResult.data && mResult.data.createTodo,
                  );
                  return state;
                },
              },
            })
            .then(
              () => done.fail(new Error('Mutation should have failed')),
              () =>
                client.mutate({
                  mutation,
                  updateQueries: {
                    todoList: (prev, options) => {
                      const mResult = options.mutationResult as any;
                      const state = cloneDeep(prev) as any;
                      state.todoList.todos.unshift(mResult.data.createTodo);
                      return state;
                    },
                  },
                }),
            )
            .then(
              () => done.fail(new Error('Mutation should have failed')),
              () => obsHandle.refetch(),
            )
            .then(() => done(), done.fail);
        },
      });
    });

    it('error handling in reducer functions', () => {
      const oldError = console.error;
      const errors: any[] = [];
      console.error = (msg: string) => {
        errors.push(msg);
      };

      let subscriptionHandle: Subscription;
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
        .then(() => {
          // we have to actually subscribe to the query to be able to update it
          return new Promise(resolve => {
            const handle = client.watchQuery({ query });
            subscriptionHandle = handle.subscribe({
              next(res) {
                resolve(res);
              },
            });
          });
        })
        .then(() => {
          return client.mutate({
            mutation,
            updateQueries: {
              todoList: () => {
                throw new Error(`Hello... It's me.`);
              },
            },
          });
        })
        .then(() => {
          subscriptionHandle.unsubscribe();
          expect(errors).toHaveLength(1);
          expect(errors[0].message).toBe(`Hello... It's me.`);
          console.error = oldError;
        });
    });
  });

  it('does not fail if one of the previous queries did not complete correctly', done => {
    const variableQuery = gql`
      query Echo($message: String) {
        echo(message: $message)
      }
    `;

    const variables1 = {
      message: 'a',
    };

    const result1 = {
      data: {
        echo: 'a',
      },
    };

    const variables2 = {
      message: 'b',
    };

    const result2 = {
      data: {
        echo: 'b',
      },
    };

    const resetMutation = gql`
      mutation Reset {
        reset {
          echo
        }
      }
    `;

    const resetMutationResult = {
      data: {
        reset: {
          echo: '0',
        },
      },
    };

    link = mockSingleLink(
      {
        request: { query: variableQuery, variables: variables1 } as any,
        result: result1,
      },
      {
        request: { query: variableQuery, variables: variables2 } as any,
        result: result2,
      },
      {
        request: { query: resetMutation } as any,
        result: resetMutationResult,
      },
    );

    client = new ApolloClient({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });

    const watchedQuery = client.watchQuery({
      query: variableQuery,
      variables: variables1,
    });

    const firstSubs = watchedQuery.subscribe({
      next: () => null,
      error: done.fail,
    });

    // Cancel the query right away!
    firstSubs.unsubscribe();

    let yieldCount = 0;
    watchedQuery.subscribe({
      next: ({ data }: any) => {
        yieldCount += 1;
        if (yieldCount === 1) {
          expect(data.echo).toBe('b');
          client.mutate({
            mutation: resetMutation,
            updateQueries: {
              Echo: () => {
                return { echo: '0' };
              },
            },
          });
        } else if (yieldCount === 2) {
          expect(data.echo).toBe('0');
          done();
        }
      },
      error: () => {
        // Do nothing, but quash unhandled error
      },
    });

    watchedQuery.refetch(variables2);
  });

  it('allows mutations with optional arguments', done => {
    let count = 0;

    client = new ApolloClient({
      cache: new InMemoryCache({ addTypename: false }),
      link: ApolloLink.from([
        ({ variables }: any) =>
          new Observable(observer => {
            switch (count++) {
              case 0:
                expect(variables).toEqual({ a: 1, b: 2 });
                observer.next({ data: { result: 'hello' } });
                observer.complete();
                return;
              case 1:
                expect(variables).toEqual({ a: 1, c: 3 });
                observer.next({ data: { result: 'world' } });
                observer.complete();
                return;
              case 2:
                expect(variables).toEqual({
                  a: undefined,
                  b: 2,
                  c: 3,
                });
                observer.next({ data: { result: 'goodbye' } });
                observer.complete();
                return;
              case 3:
                expect(variables).toEqual({});
                observer.next({ data: { result: 'moon' } });
                observer.complete();
                return;
              default:
                observer.error(new Error('Too many network calls.'));
                return;
            }
          }),
      ] as any),
    });

    const mutation = gql`
      mutation($a: Int!, $b: Int, $c: Int) {
        result(a: $a, b: $b, c: $c)
      }
    `;

    Promise.all([
      client.mutate({
        mutation,
        variables: { a: 1, b: 2 },
      }),
      client.mutate({
        mutation,
        variables: { a: 1, c: 3 },
      }),
      client.mutate({
        mutation,
        variables: { a: undefined, b: 2, c: 3 },
      }),
      client.mutate({
        mutation,
      }),
    ])
      .then(() => {
        expect((client.cache as InMemoryCache).extract()).toEqual({
          ROOT_MUTATION: {
            __typename: 'Mutation',
            'result({"a":1,"b":2})': 'hello',
            'result({"a":1,"c":3})': 'world',
            'result({"b":2,"c":3})': 'goodbye',
            'result({})': 'moon',
          },
        });
        done();
      })
      .catch(done.fail);
  });

  it('allows mutations with default values', done => {
    let count = 0;

    client = new ApolloClient({
      cache: new InMemoryCache({ addTypename: false }),
      link: ApolloLink.from([
        ({ variables }: any) =>
          new Observable(observer => {
            switch (count++) {
              case 0:
                expect(variables).toEqual({
                  a: 1,
                  b: 'water',
                });
                observer.next({ data: { result: 'hello' } });
                observer.complete();
                return;
              case 1:
                expect(variables).toEqual({
                  a: 2,
                  b: 'cheese',
                  c: 3,
                });
                observer.next({ data: { result: 'world' } });
                observer.complete();
                return;
              case 2:
                expect(variables).toEqual({
                  a: 1,
                  b: 'cheese',
                  c: 3,
                });
                observer.next({ data: { result: 'goodbye' } });
                observer.complete();
                return;
              default:
                observer.error(new Error('Too many network calls.'));
                return;
            }
          }),
      ] as any),
    });

    const mutation = gql`
      mutation($a: Int = 1, $b: String = "cheese", $c: Int) {
        result(a: $a, b: $b, c: $c)
      }
    `;

    Promise.all([
      client.mutate({
        mutation,
        variables: { a: 1, b: 'water' },
      }),
      client.mutate({
        mutation,
        variables: { a: 2, c: 3 },
      }),
      client.mutate({
        mutation,
        variables: { c: 3 },
      }),
    ])
      .then(() => {
        expect((client.cache as InMemoryCache).extract()).toEqual({
          ROOT_MUTATION: {
            __typename: 'Mutation',
            'result({"a":1,"b":"water"})': 'hello',
            'result({"a":2,"b":"cheese","c":3})': 'world',
            'result({"a":1,"b":"cheese","c":3})': 'goodbye',
          },
        });
        done();
      })
      .catch(done.fail);
  });

  it('will pass null to the network interface when provided', done => {
    let count = 0;

    client = new ApolloClient({
      cache: new InMemoryCache({ addTypename: false }),
      link: ApolloLink.from([
        ({ variables }: any) =>
          new Observable(observer => {
            switch (count++) {
              case 0:
                expect(variables).toEqual({
                  a: 1,
                  b: 2,
                  c: null,
                });
                observer.next({ data: { result: 'hello' } });
                observer.complete();
                return;
              case 1:
                expect(variables).toEqual({
                  a: 1,
                  b: null,
                  c: 3,
                });
                observer.next({ data: { result: 'world' } });
                observer.complete();
                return;
              case 2:
                expect(variables).toEqual({
                  a: null,
                  b: null,
                  c: null,
                });
                observer.next({ data: { result: 'moon' } });
                observer.complete();
                return;
              default:
                observer.error(new Error('Too many network calls.'));
                return;
            }
          }),
      ] as any),
    });

    const mutation = gql`
      mutation($a: Int!, $b: Int, $c: Int) {
        result(a: $a, b: $b, c: $c)
      }
    `;

    Promise.all([
      client.mutate({
        mutation,
        variables: { a: 1, b: 2, c: null },
      }),
      client.mutate({
        mutation,
        variables: { a: 1, b: null, c: 3 },
      }),
      client.mutate({
        mutation,
        variables: { a: null, b: null, c: null },
      }),
    ])
      .then(() => {
        expect((client.cache as InMemoryCache).extract()).toEqual({
          ROOT_MUTATION: {
            __typename: 'Mutation',
            'result({"a":1,"b":2,"c":null})': 'hello',
            'result({"a":1,"b":null,"c":3})': 'world',
            'result({"a":null,"b":null,"c":null})': 'moon',
          },
        });
        done();
      })
      .catch(done.fail);
  });

  describe('store transaction updater', () => {
    const mutation = gql`
      mutation createTodo {
        # skipping arguments in the test since they don't matter
        createTodo {
          id
          text
          completed
          __typename
        }
        __typename
      }
    `;

    const mutationResult = {
      data: {
        __typename: 'Mutation',
        createTodo: {
          id: '99',
          __typename: 'Todo',
          text: 'This one was created with a mutation.',
          completed: true,
        },
      },
    };

    it('analogous of ARRAY_INSERT', () => {
      let subscriptionHandle: Subscription;
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
        .then(() => {
          // we have to actually subscribe to the query to be able to update it
          return new Promise(resolve => {
            const handle = client.watchQuery({ query });
            subscriptionHandle = handle.subscribe({
              next(res) {
                resolve(res);
              },
            });
          });
        })
        .then(() => {
          return client.mutate({
            mutation,
            update: (proxy, mResult: any) => {
              expect(mResult.data.createTodo.id).toBe('99');
              expect(mResult.data.createTodo.text).toBe(
                'This one was created with a mutation.',
              );

              const id = 'TodoList5';
              const fragment = gql`
                fragment todoList on TodoList {
                  todos {
                    id
                    text
                    completed
                    __typename
                  }
                }
              `;

              const data: any = proxy.readFragment({ id, fragment });

              proxy.writeFragment({
                data: {
                  ...data,
                  todos: [mResult.data.createTodo, ...data.todos],
                },
                id,
                fragment,
              });
            },
          });
        })
        .then(() => {
          return client.query({ query });
        })
        .then((newResult: any) => {
          subscriptionHandle.unsubscribe();

          // There should be one more todo item than before
          expect(newResult.data.todoList.todos.length).toBe(4);

          // Since we used `prepend` it should be at the front
          expect(newResult.data.todoList.todos[0].text).toBe(
            'This one was created with a mutation.',
          );
        });
    });

    it('does not fail if optional query variables are not supplied', () => {
      let subscriptionHandle: Subscription;
      const mutationWithVars = gql`
        mutation createTodo($requiredVar: String!, $optionalVar: String) {
          createTodo(requiredVar: $requiredVar, optionalVar: $optionalVar) {
            id
            text
            completed
            __typename
          }
          __typename
        }
      `;

      // the test will pass if optionalVar is uncommented
      const variables = {
        requiredVar: 'x',
        // optionalVar: 'y',
      };
      return setup({
        request: {
          query: mutationWithVars,
          variables,
        },
        result: mutationResult,
      })
        .then(() => {
          // we have to actually subscribe to the query to be able to update it
          return new Promise(resolve => {
            const handle = client.watchQuery({
              query,
              variables,
            });
            subscriptionHandle = handle.subscribe({
              next(res) {
                resolve(res);
              },
            });
          });
        })
        .then(() => {
          return client.mutate({
            mutation: mutationWithVars,
            variables,
            update: (proxy, mResult: any) => {
              expect(mResult.data.createTodo.id).toBe('99');
              expect(mResult.data.createTodo.text).toBe(
                'This one was created with a mutation.',
              );

              const id = 'TodoList5';
              const fragment = gql`
                fragment todoList on TodoList {
                  todos {
                    id
                    text
                    completed
                    __typename
                  }
                }
              `;

              const data: any = proxy.readFragment({ id, fragment });

              proxy.writeFragment({
                data: {
                  ...data,
                  todos: [mResult.data.createTodo, ...data.todos],
                },
                id,
                fragment,
              });
            },
          });
        })
        .then(() => {
          return client.query({ query });
        })
        .then((newResult: any) => {
          subscriptionHandle.unsubscribe();

          // There should be one more todo item than before
          expect(newResult.data.todoList.todos.length).toBe(4);

          // Since we used `prepend` it should be at the front
          expect(newResult.data.todoList.todos[0].text).toBe(
            'This one was created with a mutation.',
          );
        });
    });

    it('does not make next queries fail if a mutation fails', done => {
      const obsHandle = setupObsHandle(
        {
          request: { query: mutation },
          result: { errors: [new Error('mock error')] },
        },
        {
          request: { query: queryWithTypename },
          result,
        },
      );

      obsHandle.subscribe({
        next() {
          client
            .mutate({
              mutation,
              update: (proxy, mResult: any) => {
                expect(mResult.data.createTodo.id).toBe('99');
                expect(mResult.data.createTodo.text).toBe(
                  'This one was created with a mutation.',
                );

                const id = 'TodoList5';
                const fragment = gql`
                  fragment todoList on TodoList {
                    todos {
                      id
                      text
                      completed
                      __typename
                    }
                  }
                `;

                const data: any = proxy.readFragment({ id, fragment });

                proxy.writeFragment({
                  data: {
                    ...data,
                    todos: [mResult.data.createTodo, ...data.todos],
                  },
                  id,
                  fragment,
                });
              },
            })
            .then(
              () => done.fail(new Error('Mutation should have failed')),
              () =>
                client.mutate({
                  mutation,
                  update: (proxy, mResult: any) => {
                    expect(mResult.data.createTodo.id).toBe('99');
                    expect(mResult.data.createTodo.text).toBe(
                      'This one was created with a mutation.',
                    );

                    const id = 'TodoList5';
                    const fragment = gql`
                      fragment todoList on TodoList {
                        todos {
                          id
                          text
                          completed
                          __typename
                        }
                      }
                    `;

                    const data: any = proxy.readFragment({ id, fragment });

                    proxy.writeFragment({
                      data: {
                        ...data,
                        todos: [mResult.data.createTodo, ...data.todos],
                      },
                      id,
                      fragment,
                    });
                  },
                }),
            )
            .then(
              () => done.fail(new Error('Mutation should have failed')),
              () => obsHandle.refetch(),
            )
            .then(() => done(), done.fail);
        },
      });
    });
    it('error handling in reducer functions', () => {
      const oldError = console.error;
      const errors: any[] = [];
      console.error = (msg: string) => {
        errors.push(msg);
      };

      let subscriptionHandle: Subscription;
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
        .then(() => {
          // we have to actually subscribe to the query to be able to update it
          return new Promise(resolve => {
            const handle = client.watchQuery({ query });
            subscriptionHandle = handle.subscribe({
              next(res) {
                resolve(res);
              },
            });
          });
        })
        .then(() => {
          return client.mutate({
            mutation,
            update: () => {
              throw new Error(`Hello... It's me.`);
            },
          });
        })
        .then(() => {
          subscriptionHandle.unsubscribe();
          expect(errors).toHaveLength(1);
          expect(errors[0].message).toBe(`Hello... It's me.`);
          console.error = oldError;
        });
    });
  });
});
