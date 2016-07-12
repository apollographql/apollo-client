import * as chai from 'chai';
const { assert } = chai;

import mockNetworkInterface from './mocks/mockNetworkInterface';
import ApolloClient, { addTypename } from '../src';
import { MutationBehaviorReducerArgs, MutationBehavior } from '../src/data/mutationResults';
import { NormalizedCache, StoreObject } from '../src/data/store';

import assign = require('lodash.assign');

import gql from 'graphql-tag';

describe('optimistic mutation results', () => {
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

  const result = {
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
  let networkInterface;

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

  function setup(...mockedResponses) {
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

    return client.query({
      query,
    });
  };

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

    const optimisticResponse = {
      __typename: 'Mutation',
      createTodo: {
        __typename: 'Todo',
        id: '99',
        text: 'Optimistically generated',
        completed: true,
      },
    };

    it('correctly optimistically integrates a basic object to the list', () => {
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        const dataId = client.dataId({
          __typename: 'TodoList',
          id: '5',
        });
        const promise = client.mutate({
          mutation,
          optimisticResponse,
          resultBehaviors: [
            {
              type: 'ARRAY_INSERT',
              resultPath: [ 'createTodo' ],
              storePath: [ dataId, 'todos' ],
              where: 'PREPEND',
            },
          ],
        });

        const dataInStore = client.queryManager.getDataWithOptimisticResults();
        assert.equal((dataInStore['Todo99'] as any).text, 'Optimistically generated');

        return promise;
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        // New todo item
        assert.equal(newResult.data.todoList.todos.length, 4);
        // Prepended to the front
        assert.equal(newResult.data.todoList.todos[0].text, 'This one was created with a mutation.');
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

    // optimistic response is the same
    const optimisticResponse = mutationResult.data;

    it('correctly optimistically deletes object from array', () => {
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        const promise = client.mutate({
          mutation,
          optimisticResponse,
          resultBehaviors: [
            {
              type: 'DELETE',
              dataId: 'Todo3',
            },
          ],
        });

        // check that the store already doesn't contain the todo 3
        const dataInStore = client.queryManager.getDataWithOptimisticResults();
        const refsList = (dataInStore['TodoList5'] as any).todos;
        assert.notInclude(refsList, 'Todo3');

        return promise;
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        // There should be one fewer todo item than before
        assert.equal(newResult.data.todoList.todos.length, 2);

        // The item shouldn't be in the store anymore
        assert.notProperty(client.queryManager.getApolloState().data, 'Todo3');
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
    const optimisticResponse = {
      __typename: 'Mutation',
      setSomething: {
        __typename: 'Value',
        aValue: 'Does not matter',
      },
    };

    it('optimistically runs the custom reducer', () => {
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        const promise = client.mutate({
          mutation,
          optimisticResponse,
          resultBehaviors: [
            {
              type: 'CUSTOM_MUTATION_RESULT',
              dataId: 'Todo3',
              field: 'text',
              value: 'this is the new text',
            } as any as MutationBehavior,
          ],
        });

        const dataInStore = client.queryManager.getDataWithOptimisticResults();
        assert.equal((dataInStore['Todo3'] as any).text, 'this is the new text');

        return promise;
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

  describe('ARRAY_DELETE', () => {
    const mutation = gql`
      mutation deleteTodoFromList {
        # skipping arguments in the test since they don't matter
        deleteTodoFromList {
          id
          __typename
        }
        __typename
      }
    `;

    const mutationResult = {
      data: {
        __typename: 'Mutation',
        deleteTodoFromList: {
          __typename: 'Todo',
          id: '3',
        },
      },
    };

    // optimistic response is the same
    const optimisticResponse = mutationResult.data;

    it('optimistically removes item from array but not from store', () => {
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        const dataId = client.dataId({
          __typename: 'TodoList',
          id: '5',
        });
        const promise = client.mutate({
          mutation,
          optimisticResponse,
          resultBehaviors: [
            {
              type: 'ARRAY_DELETE',
              dataId: 'Todo3',
              storePath: [dataId, 'todos'],
            },
          ],
        });

        // check that the store already doesn't contain the todo 3
        const dataInStore = client.queryManager.getDataWithOptimisticResults();
        const refsList = (dataInStore['TodoList5'] as any).todos;
        assert.notInclude(refsList, 'Todo3');
        assert.property(dataInStore, 'Todo3');

        return promise;
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        // There should be one fewer todo item than before
        assert.equal(newResult.data.todoList.todos.length, 2);

        // The item should be in the store anymore
        assert.property(client.queryManager.getApolloState().data, 'Todo3');
      });
    });
  });

  describe('error handling', () => {
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

    const mutationResult2 = {
      data: assign({}, mutationResult.data, {
        createTodo: assign({}, mutationResult.data.createTodo, {
          id: '66',
          text: 'Second mutation.',
        }),
      }),
    };

    const optimisticResponse = {
      __typename: 'Mutation',
      createTodo: {
        __typename: 'Todo',
        id: '99',
        text: 'Optimistically generated',
        completed: true,
      },
    };

    const optimisticResponse2 = assign({}, optimisticResponse, {
      createTodo: assign({}, optimisticResponse.createTodo, {
        id: '66',
        text: 'Optimistically generated 2',
      }),
    });

    it('handles a single error for a single mutation', () => {
      return setup({
        request: { query: mutation },
        error: new Error('forbidden (test error)'),
      })
      .then(() => {
        const dataId = client.dataId({
          __typename: 'TodoList',
          id: '5',
        });
        const promise = client.mutate({
          mutation,
          optimisticResponse,
          resultBehaviors: [
            {
              type: 'ARRAY_INSERT',
              resultPath: [ 'createTodo' ],
              storePath: [ dataId, 'todos' ],
              where: 'PREPEND',
            },
          ],
        });

        const dataInStore = client.queryManager.getDataWithOptimisticResults();
        assert.equal((dataInStore['TodoList5'] as any).todos.length, 4);
        assert.equal((dataInStore['Todo99'] as any).text, 'Optimistically generated');

        return promise;
      })
      .catch((err) => {
        assert.instanceOf(err, Error);
        assert.equal(err.message, 'forbidden (test error)');

        const dataInStore = client.queryManager.getDataWithOptimisticResults();
        assert.equal((dataInStore['TodoList5'] as any).todos.length, 3);
        assert.notProperty(dataInStore, 'Todo99');
      });
    });

    it('handles errors produced by one mutation in a series', () => {
      return setup({
        request: { query: mutation },
        error: new Error('forbidden (test error)'),
      }, {
        request: { query: mutation },
        result: mutationResult2,
      })
      .then(() => {
        const dataId = client.dataId({
          __typename: 'TodoList',
          id: '5',
        });
        const resultBehaviors = [
          {
            type: 'ARRAY_INSERT',
            resultPath: [ 'createTodo' ],
            storePath: [ dataId, 'todos' ],
            where: 'PREPEND',
          } as MutationBehavior,
        ];
        const promise = client.mutate({
          mutation,
          optimisticResponse,
          resultBehaviors,
        }).catch((err) => {
          // it is ok to fail here
          assert.instanceOf(err, Error);
          assert.equal(err.message, 'forbidden (test error)');
          return null;
        });

        const promise2 = client.mutate({
          mutation,
          optimisticResponse: optimisticResponse2,
          resultBehaviors,
        });

        const dataInStore = client.queryManager.getDataWithOptimisticResults();
        assert.equal((dataInStore['TodoList5'] as any).todos.length, 5);
        assert.equal((dataInStore['Todo99'] as any).text, 'Optimistically generated');
        assert.equal((dataInStore['Todo66'] as any).text, 'Optimistically generated 2');

        return Promise.all([promise, promise2]);
      })
      .then(() => {
        const dataInStore = client.queryManager.getDataWithOptimisticResults();
        assert.equal((dataInStore['TodoList5'] as any).todos.length, 4);
        assert.notProperty(dataInStore, 'Todo99');
        assert.property(dataInStore, 'Todo66');
        assert.include((dataInStore['TodoList5'] as any).todos, 'Todo66');
        assert.notInclude((dataInStore['TodoList5'] as any).todos, 'Todo99');
      });
    });
    it('can run 2 mutations concurrently and handles all intermediate states well', () => {
      function checkBothMutationsAreApplied(expectedText1, expectedText2) {
        const dataInStore = client.queryManager.getDataWithOptimisticResults();
        assert.equal((dataInStore['TodoList5'] as any).todos.length, 5);
        assert.property(dataInStore, 'Todo99');
        assert.property(dataInStore, 'Todo66');
        assert.include((dataInStore['TodoList5'] as any).todos, 'Todo66');
        assert.include((dataInStore['TodoList5'] as any).todos, 'Todo99');
        assert.equal((dataInStore['Todo99'] as any).text, expectedText1);
        assert.equal((dataInStore['Todo66'] as any).text, expectedText2);
      }
      return setup({
        request: { query: mutation },
        result: mutationResult,
      }, {
        request: { query: mutation },
        result: mutationResult2,
        // make sure it always happens later
        delay: 100,
      })
      .then(() => {
        const dataId = client.dataId({
          __typename: 'TodoList',
          id: '5',
        });
        const resultBehaviors = [
          {
            type: 'ARRAY_INSERT',
            resultPath: [ 'createTodo' ],
            storePath: [ dataId, 'todos' ],
            where: 'PREPEND',
          } as MutationBehavior,
        ];
        const promise = client.mutate({
          mutation,
          optimisticResponse,
          resultBehaviors,
        }).then((res) => {
          checkBothMutationsAreApplied('This one was created with a mutation.', 'Optimistically generated 2');
          const mutationsState = client.store.getState().apollo.mutations;
          assert.equal(mutationsState[2].loading, false);
          assert.equal(mutationsState[3].loading, true);

          return res;
        });

        const promise2 = client.mutate({
          mutation,
          optimisticResponse: optimisticResponse2,
          resultBehaviors,
        }).then((res) => {
          checkBothMutationsAreApplied('This one was created with a mutation.', 'Second mutation.');
          const mutationsState = client.store.getState().apollo.mutations;
          assert.equal(mutationsState[2].loading, false);
          assert.equal(mutationsState[3].loading, false);

          return res;
        });

        const mutationsState = client.store.getState().apollo.mutations;
        assert.equal(mutationsState[2].loading, true);
        assert.equal(mutationsState[3].loading, true);

        checkBothMutationsAreApplied('Optimistically generated', 'Optimistically generated 2');

        return Promise.all([promise, promise2]);
      })
      .then(() => {
        checkBothMutationsAreApplied('This one was created with a mutation.', 'Second mutation.');
      });
    });
  });
});
