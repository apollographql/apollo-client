import { assert } from 'chai';
import mockNetworkInterface from './mocks/mockNetworkInterface';
import ApolloClient, { addTypename } from '../src';
import { MutationBehaviorReducerArgs, MutationBehavior, cleanArray } from '../src/data/mutationResults';
import { NormalizedCache, StoreObject } from '../src/data/store';

import assign = require('lodash.assign');
import clonedeep = require('lodash.clonedeep');

import gql from 'graphql-tag';

describe('mutation results', () => {
  const query = gql`
    query todoList {
      __typename
      todoList(id: 5) {
        __typename
        id
        todos {
          id
          __typename
          text
          completed
        }
        filteredTodos: todos(completed: true) {
          id
          __typename
          text
          completed
        }
      }
      noIdList: todoList(id: 6) {
        __typename
        id
        todos {
          __typename
          text
          completed
        }
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

  let client: ApolloClient;
  let networkInterface: any;

  type CustomMutationBehavior = {
    type: 'CUSTOM_MUTATION_RESULT',
    dataId: string,
    field: string,
    value: any,
  }

  // This is an example of a basic mutation reducer that just sets a field in the store
  function customMutationReducer(state: NormalizedCache, {
    behavior,
  }: MutationBehaviorReducerArgs): NormalizedCache {
    const customBehavior = behavior as any as CustomMutationBehavior;

    state[customBehavior.dataId] = assign({}, state[customBehavior.dataId], {
      [customBehavior.field]: customBehavior.value,
    }) as StoreObject;

    return state;
  }

  function setupObsHandle(...mockedResponses: any[]) {
    networkInterface = mockNetworkInterface({
      request: { query },
      result,
    }, ...mockedResponses);

    client = new ApolloClient({
      networkInterface,
      queryTransformer: addTypename,
      dataIdFromObject: (obj: any) => {
        if (obj.id && obj.__typename) {
          return obj.__typename + obj.id;
        }
        return null;
      },

      mutationBehaviorReducers: {
        'CUSTOM_MUTATION_RESULT': customMutationReducer,
      },
    });

    return client.watchQuery({
      query,
    });
  }

  function setup(...mockedResponses: any[]) {
    const obsHandle = setupObsHandle(...mockedResponses);
    return obsHandle.result();
  };

  it('correctly primes cache for tests', () => {
    return setup()
      .then(() => client.query({
        query,
      }));
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
      assert.isTrue(newResult.data.todoList.todos[0].completed);
    });
  });

  describe('ARRAY_INSERT', () => {
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
          __typename: 'Todo',
          id: '99',
          text: 'This one was created with a mutation.',
          completed: true,
        },
      },
    };

    const mutationNoId = gql`
      mutation createTodo {
        # skipping arguments in the test since they don't matter
        createTodo {
          text
          completed
          __typename
        }
        __typename
      }
    `;

    const mutationResultNoId = {
      data: {
        __typename: 'Mutation',
        createTodo: {
          __typename: 'Todo',
          text: 'This one was created with a mutation.',
          completed: true,
        },
      },
    };

    it('correctly integrates a basic object at the beginning', () => {
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        const dataId = client.dataId({
          __typename: 'TodoList',
          id: '5',
        });

        return client.mutate({
          mutation,
          resultBehaviors: [
            {
              type: 'ARRAY_INSERT',
              resultPath: [ 'createTodo' ],
              storePath: [ dataId, 'todos' ],
              where: 'PREPEND',
            },
          ],
        });
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.todos.length, 4);

        // Since we used `prepend` it should be at the front
        assert.equal(newResult.data.todoList.todos[0].text, 'This one was created with a mutation.');
      });
    });

    it('correctly integrates a basic object at the end', () => {
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        return client.mutate({
          mutation,
          resultBehaviors: [
            {
              type: 'ARRAY_INSERT',
              resultPath: [ 'createTodo' ],
              storePath: [ 'TodoList5', 'todos' ],
              where: 'APPEND',
            },
          ],
        });
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.todos.length, 4);

        // Since we used `APPEND` it should be at the end
        assert.equal(newResult.data.todoList.todos[3].text, 'This one was created with a mutation.');
      });
    });

    it('correctly integrates a basic object at the end with arguments', () => {
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        return client.mutate({
          mutation,
          resultBehaviors: [
            {
              type: 'ARRAY_INSERT',
              resultPath: [ 'createTodo' ],
              storePath: [
                'TodoList5',
                client.fieldWithArgs('todos', {completed: true}),
              ],
              where: 'APPEND',
            },
          ],
        });
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.filteredTodos.length, 1);
        assert.equal(newResult.data.todoList.filteredTodos[0].text, 'This one was created with a mutation.');
      });
    });

    it('correctly integrates a basic object at the end without id', () => {
      return setup({
        request: { query: mutationNoId },
        result: mutationResultNoId,
      })
      .then(() => {
        return client.mutate({
          mutation: mutationNoId,
          resultBehaviors: [
            {
              type: 'ARRAY_INSERT',
              resultPath: [ 'createTodo' ],
              storePath: [ 'TodoList7', 'todos' ],
              where: 'APPEND',
            },
          ],
        });
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        // There should be one more todo item than before
        assert.equal(newResult.data.noIdList.todos.length, 4);

        // Since we used `APPEND` it should be at the end
        assert.equal(newResult.data.noIdList.todos[3].text, 'This one was created with a mutation.');
      });
    });

    it('accepts two operations', () => {
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        return client.mutate({
          mutation,
          resultBehaviors: [
            {
              type: 'ARRAY_INSERT',
              resultPath: [ 'createTodo' ],
              storePath: [ 'TodoList5', 'todos' ],
              where: 'PREPEND',
            }, {
              type: 'ARRAY_INSERT',
              resultPath: [ 'createTodo' ],
              storePath: [ 'TodoList5', 'todos' ],
              where: 'APPEND',
            },
          ],
        });
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.todos.length, 5);

        // There will be two copies
        assert.equal(newResult.data.todoList.todos[0].text, 'This one was created with a mutation.');

        assert.equal(newResult.data.todoList.todos[4].text, 'This one was created with a mutation.');
      });
    });
  });

  describe('DELETE', () => {
    const mutation = gql`
      mutation deleteTodo {
        # skipping arguments in the test since they don't matter
        deleteTodo {
          id
          __typename
        }
        __typename
      }
    `;

    const mutationResult = {
      data: {
        __typename: 'Mutation',
        deleteTodo: {
          __typename: 'Todo',
          id: '3',
        },
      },
    };

    it('deletes object from array and store', () => {
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        return client.mutate({
          mutation,
          resultBehaviors: [
            {
              type: 'DELETE',
              dataId: 'Todo3',
            },
          ],
        });
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        // There should be one fewer todo item than before
        assert.equal(newResult.data.todoList.todos.length, 2);

        // The item shouldn't be in the store anymore
        assert.notProperty(client.queryManager.getApolloState().data, 'Todo3');
        // shouldn't have affected other data elements
        assert.notEqual(client.queryManager.getApolloState().data['TodoList5']['__typename'], undefined);
      });
    });
  });

  describe('ARRAY_DELETE', () => {
    const mutation = gql`
      mutation removeTodo {
        # skipping arguments in the test since they don't matter
        removeTodo {
          id
          __typename
        }
        __typename
      }
    `;

    const mutationResult = {
      data: {
        __typename: 'Mutation',
        removeTodo: {
          __typename: 'Todo',
          id: '3',
        },
      },
    };

    it('deletes an object from array but not store', () => {
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        return client.mutate({
          mutation,
          resultBehaviors: [
            {
              type: 'ARRAY_DELETE',
              dataId: 'Todo3',
              storePath: ['TodoList5', 'todos'],
            },
          ],
        });
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        // There should be one fewer todo item than before
        assert.equal(newResult.data.todoList.todos.length, 2);

        // The item is still in the store
        assert.property(client.queryManager.getApolloState().data, 'Todo3');
      });
    });
  });

  describe('CUSTOM_MUTATION_RESULT', () => {
    const mutation = gql`
      mutation setField {
        # skipping arguments in the test since they don't matter
        setSomething {
          aValue
          __typename
        }
        __typename
      }
    `;

    const mutationResult = {
      data: {
        __typename: 'Mutation',
        setSomething: {
          __typename: 'Value',
          aValue: 'rainbow',
        },
      },
    };

    it('runs the custom reducer', () => {
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        return client.mutate({
          mutation,
          resultBehaviors: [
            {
              type: 'CUSTOM_MUTATION_RESULT',
              dataId: 'Todo3',
              field: 'text',
              value: 'this is the new text',
            } as any as MutationBehavior,
          ],
        });
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        // Our custom reducer has indeed modified the state!
        assert.equal(newResult.data.todoList.todos[0].text, 'this is the new text');
      });
    });
  });

  describe('array cleaning for ARRAY_DELETE', () => {
    it('maintains reference on flat array', () => {
      const array = [1, 2, 3, 4, 5];
      assert.isTrue(cleanArray(array, 6) === array);
      assert.isFalse(cleanArray(array, 3) === array);
    });

    it('works on nested array', () => {
      const array = [
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
      ];

      const cleaned = cleanArray(array, 5);
      assert.equal(cleaned[0].length, 4);
      assert.equal(cleaned[1].length, 5);
    });

    it('maintains reference on nested array', () => {
      const array = [
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
      ];

      assert.isTrue(cleanArray(array, 11) === array);
      assert.isFalse(cleanArray(array, 5) === array);
    });
  });

  describe('query result reducers', () => {
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
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        return client.mutate({
          mutation,
          updateQueries: {
            todoList: (prev, options) => {
              const mResult = options.mutationResult as any;
              assert.equal(mResult.data.createTodo.id, '99');
              assert.equal(mResult.data.createTodo.text, 'This one was created with a mutation.');

              const state = clonedeep(prev) as any;
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
        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.todos.length, 4);

        // Since we used `prepend` it should be at the front
        assert.equal(newResult.data.todoList.todos[0].text, 'This one was created with a mutation.');
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
            assert.equal(mResult.data.createTodo.id, '99');
            assert.equal(mResult.data.createTodo.text, 'This one was created with a mutation.');

            const state = clonedeep(prev) as any;
            state.todoList.todos.unshift(mResult.data.createTodo);
            return state;
          },
        },
      });
    });

    it('does not make next queries fail if a mutation fails', (done) => {
      const obsHandle = setupObsHandle({
        request: { query: mutation },
        result: {errors: [new Error('mock error')]},
      }, {
        request: { query },
        result,
      });

      obsHandle.subscribe({
        next() {
          client.mutate({
            mutation,
            updateQueries: {
              todoList: (prev, options) => {
                const mResult = options.mutationResult as any;
                const state = clonedeep(prev) as any;
                state.todoList.todos.unshift(mResult.data.createTodo);
                return state;
              },
            },
          })
          .then(
            () => done(new Error('Mutation should have failed')),
            () => client.mutate({
              mutation,
              updateQueries: {
                todoList: (prev, options) => {
                  const mResult = options.mutationResult as any;
                  const state = clonedeep(prev) as any;
                  state.todoList.todos.unshift(mResult.data.createTodo);
                  return state;
                },
              },
            }),
          )
          .then(
            () => done(new Error('Mutation should have failed')),
            () => obsHandle.refetch(),
          )
          .then(() => done(), done);
        },
      });
    });

    it('error handling in reducer functions', () => {
      const oldError = console.error;
      const errors: any[] = [];
      console.error = (msg: string) => {
        errors.push(msg);
      };

      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        return client.mutate({
          mutation,
          updateQueries: {
            todoList: (prev, options) => {
              throw new Error(`Hello... It's me.`);
            },
          },
        });
      })
      .then(() => {
        assert.lengthOf(errors, 1);
        assert.equal(errors[0].message, `Hello... It's me.`);
        console.error = oldError;
      });
    });
  });

  it('does not fail if one of the previous queries did not complete correctly', (done) => {
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

    networkInterface = mockNetworkInterface({
      request: { query: variableQuery, variables: variables1 },
      result: result1,
    }, {
      request: { query: variableQuery, variables: variables2 },
      result: result2,
    }, {
      request: { query: resetMutation },
      result: resetMutationResult,
    });

    client = new ApolloClient({networkInterface});

    const watchedQuery = client.watchQuery({query: variableQuery, variables: variables1});

    const firstSubs = watchedQuery.subscribe({
      next: () => null,
    });

    // Cancel the query right away!
    firstSubs.unsubscribe();

    let yieldCount = 0;
    watchedQuery.subscribe({
      next: ({data}: any) => {
        yieldCount += 1;
        if (yieldCount === 1) {
          assert.equal(data.echo, 'b');
          client.mutate({
            mutation: resetMutation,
            updateQueries: {
              Echo: (prev, options) => {
                return {echo: '0'};
              },
            },
          });
        } else if (yieldCount === 2) {
          assert.equal(data.echo, '0');
          done();
        }
      },
    });

    watchedQuery.refetch(variables2);
  });
});
